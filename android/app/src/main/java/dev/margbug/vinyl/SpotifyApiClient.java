package dev.margbug.vinyl;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SpotifyApiClient {

    private static final String TAG = "SpotifyApiClient";
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    private static final ExecutorService executor = Executors.newCachedThreadPool();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    private static final String[][] TOTP_SECRETS = {
            {",7/*F(\"rLJ2oxaKL^f+E1xvP@N", "61"},
            {"OmE{ZA.J^\":0FG\\Uz?[@WW", "60"},
            {"{iOFn;4}<1PFYKPV?5{%u14]M>/V0hDH", "59"}
    };

    private static Context appContext;

    public static void init(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
        }
    }

    public static HttpURLConnection openConnection(URL url) throws Exception {
        if (appContext != null) {
            SharedPreferences prefs = appContext.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
            String proxyStr = prefs.getString("proxy", null);
            if (proxyStr != null && !proxyStr.trim().isEmpty()) {
                String clean = proxyStr.trim().replace("http://", "").replace("https://", "");
                String[] parts = clean.split(":");
                if (parts.length == 2) {
                    try {
                        String host = parts[0];
                        int port = Integer.parseInt(parts[1]);
                        java.net.Proxy proxy = new java.net.Proxy(java.net.Proxy.Type.HTTP, new java.net.InetSocketAddress(host, port));
                        return (HttpURLConnection) url.openConnection(proxy);
                    } catch (Exception ignored) {}
                }
            }
        }
        return (HttpURLConnection) url.openConnection();
    }

    public interface ApiCallback {
        void onSuccess(String response);
        void onError(Exception error);
    }

    private static byte[] unmaskTotpSecret(String masked) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < masked.length(); i++) {
            char c = masked.charAt(i);
            sb.append(((int) c) ^ ((i % 33) + 9));
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String computeTotp(byte[] key, long timeMs) {
        try {
            long counter = timeMs / 1000 / 30;
            ByteBuffer buffer = ByteBuffer.allocate(8);
            buffer.putLong(counter);
            byte[] counterBytes = buffer.array();

            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(counterBytes);

            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) |
                    ((hash[offset + 1] & 0xff) << 16) |
                    ((hash[offset + 2] & 0xff) << 8) |
                    (hash[offset + 3] & 0xff);
            int code = binary % 1000000;
            return String.format(Locale.US, "%06d", code);
        } catch (Exception e) {
            return "000000";
        }
    }

    private static long getServerTime() {
        try {
            URL url = new URL("https://open.spotify.com/api/server-time");
            HttpURLConnection conn = openConnection(url);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", USER_AGENT);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            if (conn.getResponseCode() == 200) {
                String body = readStream(conn.getInputStream());
                JSONObject json = new JSONObject(body);
                long sec = json.optLong("serverTime", 0);
                if (sec > 0) return sec * 1000;
            }
            conn.disconnect();
        } catch (Exception ignored) {}
        return System.currentTimeMillis();
    }

    /**
     * Obtains an Access Token from Spotify Web Player using the official TOTP signature
     * exactly like the desktop Go client.
     */
    public static void getAccessToken(Context context, ApiCallback callback) {
        executor.execute(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
                String spDc = prefs.getString(SpotifyLoginActivity.KEY_SP_DC, null);
                String savedCookies = prefs.getString(SpotifyLoginActivity.KEY_ALL_COOKIES, null);

                long nowMs = System.currentTimeMillis();
                long serverTimeMs = getServerTime();

                byte[] key = unmaskTotpSecret(TOTP_SECRETS[0][0]);
                int version = Integer.parseInt(TOTP_SECRETS[0][1]);
                String totpNow = computeTotp(key, nowMs);
                String totpServer = computeTotp(key, serverTimeMs);

                String query = "reason=init&productType=web_player" +
                        "&totp=" + totpNow +
                        "&totpServer=" + totpServer +
                        "&totpVer=" + version;

                URL url = new URL("https://open.spotify.com/api/token?" + query);
                HttpURLConnection conn = openConnection(url);
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", USER_AGENT);
                conn.setRequestProperty("Referer", "https://open.spotify.com/");
                conn.setRequestProperty("Accept", "application/json");

                StringBuilder cookieHeader = new StringBuilder();
                if (savedCookies != null && !savedCookies.isEmpty()) {
                    cookieHeader.append(savedCookies);
                }
                if (spDc != null && !spDc.isEmpty() && !cookieHeader.toString().contains("sp_dc=")) {
                    if (cookieHeader.length() > 0) cookieHeader.append("; ");
                    cookieHeader.append("sp_dc=").append(spDc);
                }

                if (cookieHeader.length() > 0) {
                    conn.setRequestProperty("Cookie", cookieHeader.toString());
                }

                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                int code = conn.getResponseCode();
                if (code >= 200 && code < 300) {
                    String body = readStream(conn.getInputStream());
                    try {
                        JSONObject json = new JSONObject(body);
                        String token = json.optString("accessToken", null);
                        if (token != null && !token.isEmpty()) {
                            prefs.edit().putString(SpotifyLoginActivity.KEY_ACCESS_TOKEN, token).apply();
                        }
                    } catch (Exception ignored) {}
                    mainHandler.post(() -> callback.onSuccess(body));
                } else {
                    String err = readStream(conn.getErrorStream());
                    mainHandler.post(() -> callback.onError(new Exception("Token fetch failed (" + code + "): " + err)));
                }
                conn.disconnect();
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Executes a Pathfinder GraphQL query against Spotify Web Player endpoints.
     */
    public static void fetchPathfinder(String operationName, String hash, JSONObject variables, String token, ApiCallback callback) {
        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("operationName", operationName);
                payload.put("variables", variables != null ? variables : new JSONObject());
                JSONObject ext = new JSONObject();
                JSONObject persisted = new JSONObject();
                persisted.put("version", 1);
                persisted.put("sha256Hash", hash);
                ext.put("persistedQuery", persisted);
                payload.put("extensions", ext);

                URL url = new URL("https://api-partner.spotify.com/pathfinder/v2/query");
                HttpURLConnection conn = openConnection(url);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("User-Agent", USER_AGENT);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
                conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
                conn.setRequestProperty("app-platform", "WebPlayer");
                if (token != null && !token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
                String res = readStream(is);
                if (code >= 200 && code < 300) {
                    mainHandler.post(() -> callback.onSuccess(res));
                } else {
                    mainHandler.post(() -> callback.onError(new Exception("Pathfinder " + code + ": " + res)));
                }
                conn.disconnect();
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Executes a GET request against spclient.wg.spotify.com (e.g. recently-played).
     */
    public static void fetchSpClient(String path, String token, ApiCallback callback) {
        executor.execute(() -> {
            try {
                URL url = new URL("https://spclient.wg.spotify.com" + path);
                HttpURLConnection conn = openConnection(url);
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", USER_AGENT);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
                conn.setRequestProperty("app-platform", "WebPlayer");
                if (token != null && !token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
                String res = readStream(is);
                if (code >= 200 && code < 300) {
                    mainHandler.post(() -> callback.onSuccess(res));
                } else {
                    mainHandler.post(() -> callback.onError(new Exception("spclient " + code + ": " + res)));
                }
                conn.disconnect();
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Resolves playable full audio stream URL using NetEase Cloud Music search index
     * when Spotify's preview_url is not provided or null.
     */
    public static void resolveAudioUrl(String title, String artist, ApiCallback callback) {
        executor.execute(() -> {
            try {
                String query = title + (artist != null && !artist.isEmpty() ? " " + artist.split(",")[0].trim() : "");
                URL searchUrl = new URL("https://music.163.com/api/cloudsearch/pc?type=1&s=" + URLEncoder.encode(query, "UTF-8") + "&limit=1");
                HttpURLConnection conn = (HttpURLConnection) searchUrl.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", USER_AGENT);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                if (conn.getResponseCode() == 200) {
                    String body = readStream(conn.getInputStream());
                    JSONObject res = new JSONObject(body);
                    JSONArray songs = res.optJSONObject("result") != null ? res.getJSONObject("result").optJSONArray("songs") : null;
                    if (songs != null && songs.length() > 0) {
                        long songId = songs.getJSONObject(0).getLong("id");
                        String audioUrl = "https://music.163.com/song/media/outer/url?id=" + songId + ".mp3";
                        JSONObject out = new JSONObject();
                        out.put("audioUrl", audioUrl);
                        out.put("songId", songId);
                        mainHandler.post(() -> callback.onSuccess(out.toString()));
                        conn.disconnect();
                        return;
                    }
                }
                conn.disconnect();
                mainHandler.post(() -> callback.onError(new Exception("No matching audio stream found")));
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    public static void getCacheSize(Context context, ApiCallback callback) {
        executor.execute(() -> {
            try {
                long size = getDirSize(context.getCacheDir());
                String formatted = formatFileSize(size);
                JSONObject out = new JSONObject();
                out.put("bytes", size);
                out.put("formatted", formatted);
                mainHandler.post(() -> callback.onSuccess(out.toString()));
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    public static void clearCache(Context context, ApiCallback callback) {
        executor.execute(() -> {
            try {
                deleteDir(context.getCacheDir());
                mainHandler.post(() -> callback.onSuccess("{\"cleared\":true}"));
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    private static long getDirSize(java.io.File dir) {
        long size = 0;
        if (dir != null && dir.isDirectory()) {
            java.io.File[] files = dir.listFiles();
            if (files != null) {
                for (java.io.File f : files) {
                    if (f.isDirectory()) size += getDirSize(f);
                    else size += f.length();
                }
            }
        }
        return size;
    }

    private static boolean deleteDir(java.io.File dir) {
        if (dir != null && dir.isDirectory()) {
            java.io.File[] files = dir.listFiles();
            if (files != null) {
                for (java.io.File f : files) {
                    if (f.isDirectory()) deleteDir(f);
                    else f.delete();
                }
            }
        }
        return dir != null && dir.delete();
    }

    private static String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char pre = "KMGTPE".charAt(exp - 1);
        return String.format(Locale.US, "%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }

    /**
     * Multi-source lyrics engine: LRCLIB + NetEase
     */
    public static void fetchLyrics(String trackId, String title, String artist, long durationSec, ApiCallback callback) {
        executor.execute(() -> {
            try {
                String lrcJson = queryLrclib(title, artist, durationSec);
                if (lrcJson != null) {
                    mainHandler.post(() -> callback.onSuccess(lrcJson));
                    return;
                }

                String neteaseJson = queryNetEase(title, artist);
                if (neteaseJson != null) {
                    mainHandler.post(() -> callback.onSuccess(neteaseJson));
                    return;
                }

                mainHandler.post(() -> callback.onSuccess("[]"));
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    private static String queryLrclib(String title, String artist, long durationSec) {
        try {
            StringBuilder sb = new StringBuilder("https://lrclib.net/api/get?");
            sb.append("track_name=").append(URLEncoder.encode(title, "UTF-8"));
            if (artist != null && !artist.isEmpty()) {
                sb.append("&artist_name=").append(URLEncoder.encode(artist.split(",")[0].trim(), "UTF-8"));
            }
            if (durationSec > 0) {
                sb.append("&duration=").append(durationSec);
            }

            URL url = new URL(sb.toString());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", USER_AGENT);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            if (conn.getResponseCode() == 200) {
                String body = readStream(conn.getInputStream());
                JSONObject json = new JSONObject(body);
                String syncedLyrics = json.optString("syncedLyrics", null);
                if (syncedLyrics != null && !syncedLyrics.isEmpty()) {
                    return parseLrcToJson(syncedLyrics, null);
                }
            }
            conn.disconnect();
        } catch (Exception ignored) {}
        return null;
    }

    private static String queryNetEase(String title, String artist) {
        try {
            String query = title + (artist != null ? " " + artist.split(",")[0].trim() : "");
            URL searchUrl = new URL("https://music.163.com/api/cloudsearch/pc?type=1&s=" + URLEncoder.encode(query, "UTF-8") + "&limit=1");
            HttpURLConnection conn = (HttpURLConnection) searchUrl.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", USER_AGENT);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            if (conn.getResponseCode() == 200) {
                String body = readStream(conn.getInputStream());
                JSONObject res = new JSONObject(body);
                JSONArray songs = res.optJSONObject("result") != null ? res.getJSONObject("result").optJSONArray("songs") : null;
                if (songs != null && songs.length() > 0) {
                    long songId = songs.getJSONObject(0).getLong("id");
                    return fetchNetEaseLyricById(songId);
                }
            }
            conn.disconnect();
        } catch (Exception ignored) {}
        return null;
    }

    private static String fetchNetEaseLyricById(long songId) {
        try {
            URL url = new URL("https://music.163.com/api/song/lyric?id=" + songId + "&lv=-1&tv=-1");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", USER_AGENT);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            if (conn.getResponseCode() == 200) {
                String body = readStream(conn.getInputStream());
                JSONObject json = new JSONObject(body);
                String lrc = json.optJSONObject("lrc") != null ? json.getJSONObject("lrc").optString("lyric", null) : null;
                String tlyric = json.optJSONObject("tlyric") != null ? json.getJSONObject("tlyric").optString("lyric", null) : null;
                if (lrc != null && !lrc.isEmpty()) {
                    return parseLrcToJson(lrc, tlyric);
                }
            }
            conn.disconnect();
        } catch (Exception ignored) {}
        return null;
    }

    private static String parseLrcToJson(String lrcText, String transText) {
        try {
            List<LyricLine> mainLines = parseLrcLines(lrcText);
            List<LyricLine> transLines = transText != null ? parseLrcLines(transText) : new ArrayList<>();

            JSONArray array = new JSONArray();
            for (LyricLine line : mainLines) {
                JSONObject obj = new JSONObject();
                obj.put("time", line.timeSec);
                obj.put("text", line.text);

                String trans = null;
                for (LyricLine t : transLines) {
                    if (Math.abs(t.timeSec - line.timeSec) < 0.5) {
                        trans = t.text;
                        break;
                    }
                }
                if (trans != null && !trans.isEmpty()) {
                    obj.put("trans", trans);
                }
                array.put(obj);
            }
            return array.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    private static class LyricLine {
        double timeSec;
        String text;
        LyricLine(double timeSec, String text) {
            this.timeSec = timeSec;
            this.text = text;
        }
    }

    private static final Pattern LRC_PATTERN = Pattern.compile("\\[(\\d+):(\\d+)(?:[\\.:](\\d+))?\\](.*)");

    private static List<LyricLine> parseLrcLines(String text) {
        List<LyricLine> lines = new ArrayList<>();
        if (text == null) return lines;
        String[] rawLines = text.split("\\r?\\n");
        for (String raw : rawLines) {
            raw = raw.trim();
            Matcher m = LRC_PATTERN.matcher(raw);
            if (m.matches()) {
                try {
                    int min = Integer.parseInt(m.group(1));
                    int sec = Integer.parseInt(m.group(2));
                    int millis = 0;
                    String msStr = m.group(3);
                    if (msStr != null) {
                        if (msStr.length() == 2) msStr += "0";
                        millis = Integer.parseInt(msStr);
                    }
                    double totalSec = min * 60 + sec + (millis / 1000.0);
                    String content = m.group(4).trim();
                    if (!content.isEmpty()) {
                        lines.add(new LyricLine(totalSec, content));
                    }
                } catch (Exception ignored) {}
            }
        }
        return lines;
    }

    private static String readStream(InputStream is) {
        if (is == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
