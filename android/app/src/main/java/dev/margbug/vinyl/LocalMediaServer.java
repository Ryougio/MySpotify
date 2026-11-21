package dev.margbug.vinyl;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;
import okhttp3.MediaType;
import okhttp3.Request;
import okhttp3.RequestBody;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Localhost-only HTTP/1.1 media & Widevine DRM proxy server (127.0.0.1:<ephemeral>).
 * Android counterpart of upstream internal/player/web.go (margbug01/MySpotify).
 */
public class LocalMediaServer {

    private static final String TAG = "LocalMediaServer";
    private static final String LICENSE_HOST = "https://spclient.wg.spotify.com/widevine-license/v1";
    private static final MediaType OCTET_STREAM = MediaType.parse("application/octet-stream");
    private static final Pattern URI_ATTR = Pattern.compile("URI=\"([^\"]*)\"");

    public interface EventListener {
        void onPlayerEvent(int gen, String type, double timeSec, String msg, int seq);
        void onLicenseResponse(int gen, int httpCode);
    }

    public static class TrackSession {
        public final int gen;
        public final String manifest;
        public final List<String> sources;
        public final String fileId;
        public final boolean isFile;
        public final long durationMs;
        public final int bitrate;
        public volatile int lastLicenseCode = 0;

        TrackSession(int gen, String manifest, List<String> sources, String fileId, boolean isFile, long durationMs, int bitrate) {
            this.gen = gen;
            this.manifest = manifest;
            this.sources = sources;
            this.fileId = fileId != null ? fileId : "";
            this.isFile = isFile;
            this.durationMs = durationMs;
            this.bitrate = bitrate;
        }
    }

    private final Context appContext;
    private final EventListener eventListener;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final AtomicInteger genCounter = new AtomicInteger(0);
    private final ConcurrentHashMap<Integer, TrackSession> sessions = new ConcurrentHashMap<>();

    private ServerSocket serverSocket;
    private volatile boolean running = false;
    private volatile int port = 0;

    private byte[] cachedPlayerHtml;
    private byte[] cachedHlsJs;

    public LocalMediaServer(Context context, EventListener listener) {
        this.appContext = context.getApplicationContext();
        this.eventListener = listener;
    }

    public synchronized int start() throws IOException {
        if (running && port > 0) return port;
        serverSocket = new ServerSocket(0, 64, InetAddress.getByName("127.0.0.1"));
        port = serverSocket.getLocalPort();
        running = true;

        pool.execute(() -> {
            Log.i(TAG, "LocalMediaServer listening on http://127.0.0.1:" + port);
            while (running) {
                try {
                    Socket sock = serverSocket.accept();
                    sock.setSoTimeout(30_000);
                    pool.execute(() -> handleClient(sock));
                } catch (IOException e) {
                    if (running) Log.w(TAG, "Accept error: " + e.getMessage());
                }
            }
        });
        return port;
    }

    public int getPort() {
        return port;
    }

    public String getPlayerUrl() {
        return "http://127.0.0.1:" + port + "/player.html?ks=com.widevine.alpha";
    }

    public TrackSession registerHlsTrack(SpotifyApiClient.SpotifyMedia media) {
        int gen = genCounter.incrementAndGet();
        List<String> sources = new ArrayList<>();
        Map<String, Integer> indexMap = new HashMap<>();
        String localized = localizeManifest(media.manifest, "/m/" + gen + "/", sources, indexMap);
        TrackSession s = new TrackSession(gen, localized, sources, media.fileId, false, media.durationMs, media.bitrate);
        pruneOldSessions(gen);
        sessions.put(gen, s);
        return s;
    }

    public TrackSession registerDirectFile(String fileUrl, long durationMs) {
        int gen = genCounter.incrementAndGet();
        List<String> sources = new ArrayList<>();
        sources.add(fileUrl);
        TrackSession s = new TrackSession(gen, "", sources, "", true, durationMs, 0);
        pruneOldSessions(gen);
        sessions.put(gen, s);
        return s;
    }

    private void pruneOldSessions(int currentGen) {
        // Keep last 3 generations alive for smooth crossfade overlap
        for (Integer k : sessions.keySet()) {
            if (k < currentGen - 2) {
                sessions.remove(k);
            }
        }
    }

    public TrackSession getSession(int gen) {
        return sessions.get(gen);
    }

    public synchronized void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {}
        sessions.clear();
    }

    private String localizeManifest(String manifest, String prefix, List<String> sources, Map<String, Integer> indexMap) {
        StringBuilder out = new StringBuilder();
        String[] lines = manifest.split("\\r?\\n");
        for (String raw : lines) {
            String line = raw;
            if (line.startsWith("#EXT-X-MAP:")) {
                Matcher m = URI_ATTR.matcher(line);
                StringBuffer sb = new StringBuffer();
                while (m.find()) {
                    String origUrl = m.group(1);
                    String localPath = mapSource(origUrl, prefix, sources, indexMap);
                    m.appendReplacement(sb, Matcher.quoteReplacement("URI=\"" + localPath + "\""));
                }
                m.appendTail(sb);
                line = sb.toString();
            } else if (!line.isEmpty() && !line.startsWith("#")) {
                line = mapSource(line.trim(), prefix, sources, indexMap);
            }
            out.append(line).append("\n");
        }
        return out.toString();
    }

    private String mapSource(String url, String prefix, List<String> sources, Map<String, Integer> indexMap) {
        Integer idx = indexMap.get(url);
        if (idx == null) {
            idx = sources.size();
            indexMap.put(url, idx);
            sources.add(url);
        }
        return prefix + idx;
    }

    private void handleClient(Socket sock) {
        try (Socket s = sock) {
            BufferedInputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();

            String reqLine = readLine(in);
            if (reqLine == null || reqLine.isEmpty()) return;
            String[] parts = reqLine.split(" ");
            if (parts.length < 2) return;
            String method = parts[0].toUpperCase(Locale.US);
            String fullPath = parts[1];

            Map<String, String> headers = new HashMap<>();
            String hLine;
            while ((hLine = readLine(in)) != null && !hLine.isEmpty()) {
                int colon = hLine.indexOf(':');
                if (colon > 0) {
                    String k = hLine.substring(0, colon).trim().toLowerCase(Locale.US);
                    String v = hLine.substring(colon + 1).trim();
                    headers.put(k, v);
                }
            }

            byte[] reqBody = new byte[0];
            String clHeader = headers.get("content-length");
            if (clHeader != null) {
                int len = 0;
                try { len = Integer.parseInt(clHeader); } catch (Exception ignored) {}
                if (len > 0 && len <= 2 * 1024 * 1024) {
                    reqBody = readExact(in, len);
                }
            }

            String path = fullPath;
            String query = "";
            int qIdx = fullPath.indexOf('?');
            if (qIdx >= 0) {
                path = fullPath.substring(0, qIdx);
                query = fullPath.substring(qIdx + 1);
            }

            if ("OPTIONS".equals(method)) {
                writeResponse(out, 204, "text/plain", new byte[0], null);
                return;
            }

            if ("/player.html".equals(path) || "/".equals(path)) {
                byte[] html = loadCombinedPlayerHtml();
                writeResponse(out, 200, "text/html; charset=utf-8", html, null);
            } else if ("/hls.min.js".equals(path)) {
                byte[] js = loadAssetCached("player/hls.min.js", false);
                writeResponse(out, 200, "text/javascript; charset=utf-8", js, null);
            } else if (path.startsWith("/m/")) {
                handleMediaRequest(out, path.substring(3), headers.get("range"));
            } else if ("/cert".equals(path)) {
                handleWidevineForward(out, "GET", LICENSE_HOST + "/application-certificate", null, parseGenParam(query));
            } else if ("/license".equals(path) && "POST".equals(method)) {
                handleWidevineForward(out, "POST", LICENSE_HOST + "/audio/license", reqBody, parseGenParam(query));
            } else if ("/event".equals(path) && "POST".equals(method)) {
                handleEvent(out, reqBody);
            } else {
                writeResponse(out, 404, "text/plain", "Not Found".getBytes(StandardCharsets.UTF_8), null);
            }
        } catch (Exception e) {
            Log.d(TAG, "Client socket closed/error: " + e.getMessage());
        }
    }

    private void handleMediaRequest(OutputStream out, String rest, String rangeHeader) throws IOException {
        int slash = rest.indexOf('/');
        if (slash <= 0) {
            writeResponse(out, 404, "text/plain", "Bad media path".getBytes(StandardCharsets.UTF_8), null);
            return;
        }
        int gen;
        try {
            gen = Integer.parseInt(rest.substring(0, slash));
        } catch (Exception e) {
            writeResponse(out, 404, "text/plain", "Bad gen".getBytes(StandardCharsets.UTF_8), null);
            return;
        }
        String part = rest.substring(slash + 1);
        TrackSession session = sessions.get(gen);
        if (session == null) {
            writeResponse(out, 404, "text/plain", "Session gone".getBytes(StandardCharsets.UTF_8), null);
            return;
        }

        if ("track.m3u8".equals(part)) {
            writeResponse(out, 200, "application/vnd.apple.mpegurl", session.manifest.getBytes(StandardCharsets.UTF_8), null);
            return;
        }

        int idx;
        try {
            idx = Integer.parseInt(part);
        } catch (Exception e) {
            writeResponse(out, 404, "text/plain", "Bad part".getBytes(StandardCharsets.UTF_8), null);
            return;
        }
        if (idx < 0 || idx >= session.sources.size()) {
            writeResponse(out, 404, "text/plain", "Part out of bounds".getBytes(StandardCharsets.UTF_8), null);
            return;
        }

        String primaryUrl = session.sources.get(idx);
        SpotifyApiClient.RawHttpResult res = fetchRangeWithMirrors(primaryUrl, session.fileId, session.isFile, rangeHeader);
        if (res == null) {
            writeResponse(out, 502, "text/plain", "Upstream CDN failed".getBytes(StandardCharsets.UTF_8), null);
            return;
        }

        Map<String, String> extra = new HashMap<>();
        if (res.contentRange != null) extra.put("Content-Range", res.contentRange);
        if (res.acceptRanges != null) extra.put("Accept-Ranges", res.acceptRanges);
        String ct = (res.contentType != null && !res.contentType.isEmpty()) ? res.contentType : "application/octet-stream";
        writeResponse(out, res.code, ct, res.body, extra);
    }

    private SpotifyApiClient.RawHttpResult fetchRangeWithMirrors(String primaryUrl, String fileId, boolean isFile, String rangeHeader) {
        try {
            SpotifyApiClient.RawHttpResult res = fetchUrlRange(primaryUrl, rangeHeader);
            if (res.code >= 200 && res.code < 300) return res;
            Log.w(TAG, "Primary CDN returned HTTP " + res.code + " for " + primaryUrl);
        } catch (Exception e) {
            Log.w(TAG, "Primary CDN failed (" + e.getMessage() + "), trying mirrors...");
        }

        if (!isFile && fileId != null && fileId.length() == 40) {
            List<String> mirrors = SpotifyApiClient.getCdnMirrorsSync(appContext, fileId);
            for (String mUrl : mirrors) {
                if (mUrl.equals(primaryUrl)) continue;
                try {
                    SpotifyApiClient.RawHttpResult mRes = fetchUrlRange(mUrl, rangeHeader);
                    if (mRes.code >= 200 && mRes.code < 300) {
                        Log.i(TAG, "CDN mirror succeeded for fileId=" + fileId);
                        return mRes;
                    }
                } catch (Exception e) {
                    Log.w(TAG, "CDN mirror failed: " + e.getMessage());
                }
            }
        }
        return null;
    }

    private SpotifyApiClient.RawHttpResult fetchUrlRange(String url, String rangeHeader) throws IOException {
        Request.Builder rb = new Request.Builder()
                .url(url)
                .header("User-Agent", SpotifyApiClient.USER_AGENT)
                .get();
        if (rangeHeader != null && !rangeHeader.isEmpty()) {
            rb.header("Range", rangeHeader);
        }
        return SpotifyApiClient.fetchCdnRangeSmart(rb.build(), 18);
    }

    private void handleWidevineForward(OutputStream out, String method, String targetUrl, byte[] body, int gen) throws IOException {
        TrackSession session = sessions.get(gen);
        if ("POST".equals(method) && session == null) {
            writeResponse(out, 410, "text/plain", "Session gone".getBytes(StandardCharsets.UTF_8), null);
            return;
        }

        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                SpotifyApiClient.Identity id = SpotifyApiClient.getIdentitySync(appContext, attempt > 0);
                Request.Builder rb = new Request.Builder()
                        .url(targetUrl)
                        .header("User-Agent", SpotifyApiClient.USER_AGENT)
                        .header("Referer", "https://open.spotify.com/");
                if (!id.clientToken.isEmpty()) {
                    rb.header("client-token", id.clientToken);
                }
                if ("POST".equals(method)) {
                    if (!id.accessToken.isEmpty()) {
                        rb.header("Authorization", "Bearer " + id.accessToken);
                    }
                    rb.post(RequestBody.create(body != null ? body : new byte[0], OCTET_STREAM));
                } else {
                    rb.get();
                }

                SpotifyApiClient.RawHttpResult res = SpotifyApiClient.executeRawWithRetry(rb.build(), 3, 15);
                if (res.code == 401 && attempt == 0) {
                    Log.w(TAG, "Widevine " + targetUrl + " returned 401, renewing token");
                    continue;
                }
                if (session != null && "POST".equals(method)) {
                    session.lastLicenseCode = res.code;
                }
                if ("POST".equals(method) && eventListener != null) {
                    eventListener.onLicenseResponse(gen, res.code);
                }
                if (res.code != 200) {
                    Log.w(TAG, "Widevine " + method + " " + targetUrl + " HTTP " + res.code + " len=" + res.body.length + " hasClientToken=" + !id.clientToken.isEmpty());
                } else {
                    Log.i(TAG, "Widevine " + method + " OK (gen=" + gen + ", len=" + res.body.length + ", hasClientToken=" + !id.clientToken.isEmpty() + ")");
                }
                writeResponse(out, res.code, "application/octet-stream", res.body, null);
                return;
            } catch (Exception e) {
                Log.e(TAG, "Widevine forward error (" + targetUrl + "): " + e.getMessage());
                if (attempt == 1) {
                    writeResponse(out, 502, "text/plain", ("Widevine forward failed: " + e.getMessage()).getBytes(StandardCharsets.UTF_8), null);
                    return;
                }
            }
        }
    }

    private void handleEvent(OutputStream out, byte[] reqBody) throws IOException {
        try {
            String jsonStr = new String(reqBody, StandardCharsets.UTF_8);
            JSONObject obj = new JSONObject(jsonStr);
            int gen = obj.optInt("gen", 0);
            String type = obj.optString("type", "");
            double t = obj.optDouble("t", 0.0);
            String msg = obj.optString("msg", "");
            int seq = obj.optInt("seq", 0);
            if (eventListener != null) {
                eventListener.onPlayerEvent(gen, type, t, msg, seq);
            }
        } catch (Exception e) {
            Log.w(TAG, "Bad /event payload: " + e.getMessage());
        }
        writeResponse(out, 204, "text/plain", new byte[0], null);
    }

    private int parseGenParam(String query) {
        if (query == null || query.isEmpty()) return 0;
        for (String kv : query.split("&")) {
            if (kv.startsWith("gen=")) {
                try { return Integer.parseInt(kv.substring(4)); } catch (Exception ignored) {}
            }
        }
        return 0;
    }

    private synchronized byte[] loadCombinedPlayerHtml() throws IOException {
        if (cachedPlayerHtml != null) return cachedPlayerHtml;
        byte[] rawHtml = loadAssetRaw("player/player.html");
        byte[] hlsJs = loadAssetCached("player/hls.min.js", false);
        String htmlStr = new String(rawHtml, StandardCharsets.UTF_8);
        String hlsStr = new String(hlsJs, StandardCharsets.UTF_8);
        String marker = "/*__HLS_JS_INLINE__*/";
        int idx = htmlStr.indexOf(marker);
        String combined;
        if (idx >= 0) {
            combined = htmlStr.substring(0, idx) + hlsStr + htmlStr.substring(idx + marker.length());
        } else {
            combined = htmlStr;
        }
        cachedPlayerHtml = combined.getBytes(StandardCharsets.UTF_8);
        Log.i(TAG, "Built combined inline player.html (" + cachedPlayerHtml.length + " bytes)");
        return cachedPlayerHtml;
    }

    private byte[] loadAssetRaw(String assetPath) throws IOException {
        AssetManager am = appContext.getAssets();
        try (InputStream is = am.open(assetPath);
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = is.read(buf)) != -1) {
                bos.write(buf, 0, n);
            }
            return bos.toByteArray();
        }
    }

    private byte[] loadAssetCached(String assetPath, boolean isHtml) throws IOException {
        if (isHtml && cachedPlayerHtml != null) return cachedPlayerHtml;
        if (!isHtml && cachedHlsJs != null) return cachedHlsJs;
        byte[] data = loadAssetRaw(assetPath);
        if (isHtml) cachedPlayerHtml = data;
        else cachedHlsJs = data;
        return data;
    }

    private String readLine(BufferedInputStream in) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        int prev = -1;
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\n') {
                byte[] arr = bos.toByteArray();
                int len = arr.length;
                if (len > 0 && arr[len - 1] == '\r') len--;
                return new String(arr, 0, len, StandardCharsets.ISO_8859_1);
            }
            bos.write(b);
            prev = b;
            if (bos.size() > 16384) break;
        }
        if (bos.size() == 0 && prev == -1) return null;
        return new String(bos.toByteArray(), StandardCharsets.ISO_8859_1);
    }

    private byte[] readExact(InputStream in, int len) throws IOException {
        byte[] buf = new byte[len];
        int off = 0;
        while (off < len) {
            int n = in.read(buf, off, len - off);
            if (n == -1) break;
            off += n;
        }
        if (off == len) return buf;
        byte[] trimmed = new byte[off];
        System.arraycopy(buf, 0, trimmed, 0, off);
        return trimmed;
    }

    private void writeResponse(OutputStream out, int code, String contentType, byte[] body, Map<String, String> extraHeaders) throws IOException {
        byte[] safeBody = body != null ? body : new byte[0];
        StringBuilder sb = new StringBuilder();
        sb.append("HTTP/1.1 ").append(code).append(" ").append(statusText(code)).append("\r\n");
        sb.append("Content-Type: ").append(contentType).append("\r\n");
        sb.append("Content-Length: ").append(safeBody.length).append("\r\n");
        sb.append("Cache-Control: no-store\r\n");
        sb.append("Access-Control-Allow-Origin: *\r\n");
        sb.append("Connection: close\r\n");
        if (extraHeaders != null) {
            for (Map.Entry<String, String> e : extraHeaders.entrySet()) {
                if (e.getValue() != null && !e.getValue().isEmpty()) {
                    sb.append(e.getKey()).append(": ").append(e.getValue()).append("\r\n");
                }
            }
        }
        sb.append("\r\n");
        out.write(sb.toString().getBytes(StandardCharsets.ISO_8859_1));
        if (safeBody.length > 0) {
            out.write(safeBody);
        }
        out.flush();
    }

    private String statusText(int code) {
        switch (code) {
            case 200: return "OK";
            case 204: return "No Content";
            case 206: return "Partial Content";
            case 400: return "Bad Request";
            case 401: return "Unauthorized";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 410: return "Gone";
            case 502: return "Bad Gateway";
            default: return "Status";
        }
    }
}
