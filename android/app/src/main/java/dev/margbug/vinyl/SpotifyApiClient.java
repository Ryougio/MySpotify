package dev.margbug.vinyl;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import okhttp3.ConnectionPool;
import okhttp3.Dns;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SpotifyApiClient {

    private static final String TAG = "SpotifyApiClient";
    public static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
    private static final MediaType JSON_MEDIA = MediaType.parse("application/json; charset=utf-8");
    private static final ExecutorService executor = Executors.newCachedThreadPool();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static final java.util.Map<String, MirrorEntry> mirrorCache = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long MIRROR_TTL_MS = 23L * 60 * 60 * 1000;

    private static class MirrorEntry {
        final List<String> urls;
        final long fetchedAtMs;
        MirrorEntry(List<String> urls, long fetchedAtMs) {
            this.urls = urls;
            this.fetchedAtMs = fetchedAtMs;
        }
    }

    public static class RawHttpResult {
        public final int code;
        public final byte[] body;
        public final String contentType;
        public final String contentRange;
        public final String acceptRanges;
        public final String contentLength;

        RawHttpResult(int code, byte[] body, String contentType, String contentRange, String acceptRanges, String contentLength) {
            this.code = code;
            this.body = body != null ? body : new byte[0];
            this.contentType = contentType;
            this.contentRange = contentRange;
            this.acceptRanges = acceptRanges;
            this.contentLength = contentLength;
        }
    }

    public static class Identity {
        public final String accessToken;
        public final String clientToken;
        public final boolean isAnonymous;

        Identity(String accessToken, String clientToken, boolean isAnonymous) {
            this.accessToken = accessToken != null ? accessToken : "";
            this.clientToken = clientToken != null ? clientToken : "";
            this.isAnonymous = isAnonymous;
        }
    }

    public static class SpotifyMedia {
        public final String manifest;
        public final String fileUrl;
        public final String fileId;
        public final long durationMs;
        public final int bitrate;

        SpotifyMedia(String manifest, String fileUrl, String fileId, long durationMs, int bitrate) {
            this.manifest = manifest != null ? manifest : "";
            this.fileUrl = fileUrl != null ? fileUrl : "";
            this.fileId = fileId != null ? fileId : "";
            this.durationMs = durationMs;
            this.bitrate = bitrate;
        }
    }

    public interface MediaCallback {
        void onSuccess(SpotifyMedia media);
        void onError(Exception error);
    }

    private static volatile OkHttpClient cachedClient;
    private static volatile String cachedProxyKey = "";

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

    private static Proxy parseConfiguredProxy() {
        if (appContext == null) return null;
        SharedPreferences prefs = appContext.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        String proxyStr = prefs.getString("proxy", null);
        if (proxyStr == null || proxyStr.trim().isEmpty()) return null;
        String raw = proxyStr.trim();
        Proxy.Type type = Proxy.Type.HTTP;
        if (raw.toLowerCase(Locale.US).startsWith("socks")) {
            type = Proxy.Type.SOCKS;
        }
        String clean = raw.replaceFirst("^(?i)(https?|socks5h?|socks4|socks)://", "");
        if (clean.contains("/")) clean = clean.substring(0, clean.indexOf("/"));
        String[] parts = clean.split(":");
        if (parts.length == 2) {
            try {
                return new Proxy(type, new InetSocketAddress(parts[0], Integer.parseInt(parts[1])));
            } catch (Exception ignored) {}
        }
        return null;
    }

    private static synchronized OkHttpClient getHttpClient() {
        String proxyKey = "";
        if (appContext != null) {
            SharedPreferences prefs = appContext.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
            proxyKey = prefs.getString("proxy", "");
            if (proxyKey == null) proxyKey = "";
        }
        if (cachedClient != null && proxyKey.equals(cachedProxyKey)) {
            return cachedClient;
        }
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .protocols(Arrays.asList(Protocol.HTTP_2, Protocol.HTTP_1_1))
                .dns(hostname -> {
                    // Prefer/force IPv4 when available (critical on Android VPN/Clash IPv4-only TUN
                    // where ISP IPv6 leaks directly out Wi-Fi and triggers TLS RST / EOFException).
                    List<InetAddress> all = Dns.SYSTEM.lookup(hostname);
                    List<InetAddress> v4 = new ArrayList<>();
                    List<InetAddress> v6 = new ArrayList<>();
                    for (InetAddress addr : all) {
                        if (addr instanceof Inet4Address) v4.add(addr);
                        else v6.add(addr);
                    }
                    return !v4.isEmpty() ? v4 : v6;
                })
                .connectTimeout(12, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .connectionPool(new ConnectionPool(8, 90, TimeUnit.SECONDS));
        Proxy p = parseConfiguredProxy();
        if (p != null) {
            builder.proxy(p);
        }
        cachedClient = builder.build();
        cachedProxyKey = proxyKey;
        return cachedClient;
    }

    private static OkHttpClient buildFallbackClient(Proxy proxyOrNull, boolean http1Only, int timeoutSec) {
        int t = timeoutSec > 0 ? timeoutSec : 15;
        OkHttpClient.Builder b = new OkHttpClient.Builder()
                .protocols(http1Only ? java.util.Collections.singletonList(Protocol.HTTP_1_1)
                        : Arrays.asList(Protocol.HTTP_2, Protocol.HTTP_1_1))
                .dns(hostname -> {
                    List<InetAddress> all = Dns.SYSTEM.lookup(hostname);
                    List<InetAddress> v4 = new ArrayList<>();
                    for (InetAddress addr : all) {
                        if (addr instanceof Inet4Address) v4.add(addr);
                    }
                    return !v4.isEmpty() ? v4 : all;
                })
                .connectTimeout(Math.min(t, 10), TimeUnit.SECONDS)
                .readTimeout(t, TimeUnit.SECONDS)
                .writeTimeout(t, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .connectionPool(new ConnectionPool(4, 30, TimeUnit.SECONDS));
        if (proxyOrNull != null) {
            b.proxy(proxyOrNull);
        }
        return b.build();
    }

    private static boolean isLocalProxyPortOpen(int port) {
        try (java.net.Socket s = new java.net.Socket()) {
            s.connect(new InetSocketAddress("127.0.0.1", port), 150);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static class HttpResult {
        final int code;
        final String body;
        HttpResult(int code, String body) {
            this.code = code;
            this.body = body;
        }
    }

    /**
     * Executes an OkHttp request returning raw bytes + headers with multi-transport retry.
     */
    public static RawHttpResult executeRawWithRetry(Request request, int maxAttempts, int timeoutSec) throws IOException {
        int attempts = Math.max(maxAttempts, 1);
        OkHttpClient client = getHttpClient();
        if (timeoutSec > 0) {
            client = client.newBuilder()
                    .connectTimeout(timeoutSec, TimeUnit.SECONDS)
                    .readTimeout(timeoutSec, TimeUnit.SECONDS)
                    .build();
        }
        IOException lastEx = null;
        Request currentReq = request;
        for (int attempt = 1; attempt <= attempts; attempt++) {
            try (Response resp = client.newCall(currentReq).execute()) {
                byte[] bytes = resp.body() != null ? resp.body().bytes() : new byte[0];
                return new RawHttpResult(
                        resp.code(),
                        bytes,
                        resp.header("Content-Type"),
                        resp.header("Content-Range"),
                        resp.header("Accept-Ranges"),
                        resp.header("Content-Length")
                );
            } catch (IOException e) {
                lastEx = e;
                String msg = e.getMessage() != null ? e.getMessage() : "";
                android.util.Log.w(TAG, "HTTP attempt " + attempt + "/" + attempts + " failed (" + request.url().host() + "): " + msg);
                try { client.connectionPool().evictAll(); } catch (Exception ignored) {}

                if (attempt == 1 && attempts > 1) {
                    if (cachedProxyKey != null && !cachedProxyKey.isEmpty()
                            && (msg.contains("127.0.0.1") || msg.contains("ECONNREFUSED"))) {
                        android.util.Log.w(TAG, "Configured proxy unreachable, falling back to direct/TUN IPv4");
                        client = buildFallbackClient(null, true, timeoutSec);
                    } else if ((cachedProxyKey == null || cachedProxyKey.isEmpty()) && isLocalProxyPortOpen(7890)) {
                        android.util.Log.d(TAG, "TUN reset detected; retrying via local Clash proxy 127.0.0.1:7890");
                        client = buildFallbackClient(new Proxy(Proxy.Type.HTTP, new InetSocketAddress("127.0.0.1", 7890)), false, timeoutSec);
                    } else {
                        client = buildFallbackClient(parseConfiguredProxy(), true, timeoutSec);
                    }
                } else if (attempt == 2 && attempts > 2) {
                    Proxy p = (cachedProxyKey == null || cachedProxyKey.isEmpty()) && isLocalProxyPortOpen(7890)
                            ? new Proxy(Proxy.Type.HTTP, new InetSocketAddress("127.0.0.1", 7890))
                            : parseConfiguredProxy();
                    client = buildFallbackClient(p, true, timeoutSec);
                    currentReq = request.newBuilder().header("Connection", "close").build();
                }

                if (attempt < attempts) {
                    try { Thread.sleep(250L * attempt); } catch (InterruptedException ignored) {}
                }
            }
        }
        throw lastEx != null ? lastEx : new IOException("Request failed");
    }

    /**
     * Executes an OkHttp request returning UTF-8 String body with smart multi-transport retry.
     */
    private static HttpResult executeWithRetry(Request request, int maxAttempts, int timeoutSec) throws IOException {
        RawHttpResult raw = executeRawWithRetry(request, Math.max(maxAttempts, 3), timeoutSec);
        return new HttpResult(raw.code, new String(raw.body, StandardCharsets.UTF_8));
    }

    public static HttpURLConnection openConnection(URL url) throws Exception {
        Proxy p = parseConfiguredProxy();
        if (p != null) {
            return (HttpURLConnection) url.openConnection(p);
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
            Request req = new Request.Builder()
                    .url("https://open.spotify.com/api/server-time")
                    .header("User-Agent", USER_AGENT)
                    .get()
                    .build();
            RawHttpResult res = executeRawWithRetry(req, 1, 3);
            if (res.code == 200) {
                JSONObject json = new JSONObject(new String(res.body, StandardCharsets.UTF_8));
                long sec = json.optLong("serverTime", 0);
                if (sec > 0) return sec * 1000L;
            }
        } catch (Exception ignored) {}
        return System.currentTimeMillis();
    }

    private static final String CLIENT_VERSION = "1.3.8.509.g26b6eac7300d";
    public static final String KEY_CLIENT_TOKEN = "client_token";
    public static final String KEY_CLIENT_TOKEN_EXPIRES = "client_token_expires";
    public static final String KEY_ACCESS_TOKEN_ANON = "access_token_is_anon";
    public static final String KEY_ACCESS_TOKEN_EXPIRES = "access_token_expires";

    private static String getOrFetchClientToken(Context context, String clientId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
            String cached = prefs.getString(KEY_CLIENT_TOKEN, null);
            long exp = prefs.getLong(KEY_CLIENT_TOKEN_EXPIRES, 0);
            long now = System.currentTimeMillis();
            if (cached != null && !cached.isEmpty() && now < exp - 300_000L) {
                return cached;
            }
            if (clientId == null || clientId.isEmpty()) {
                return cached != null ? cached : "";
            }

            String deviceId = prefs.getString("spotify_device_id", null);
            if (deviceId == null || deviceId.isEmpty()) {
                byte[] b = new byte[16];
                new java.security.SecureRandom().nextBytes(b);
                StringBuilder hex = new StringBuilder();
                for (byte x : b) hex.append(String.format(Locale.US, "%02x", x));
                deviceId = hex.toString();
                prefs.edit().putString("spotify_device_id", deviceId).apply();
            }

            JSONObject jsSdk = new JSONObject();
            jsSdk.put("device_brand", "unknown");
            jsSdk.put("device_model", "unknown");
            jsSdk.put("os", "macos");
            jsSdk.put("os_version", "10.15.7");
            jsSdk.put("container_version", "unknown");
            jsSdk.put("device_id", deviceId);
            jsSdk.put("device_type", "computer");
            jsSdk.put("platform_identifier", "web_player");

            JSONObject clientData = new JSONObject();
            clientData.put("client_version", CLIENT_VERSION);
            clientData.put("client_id", clientId);
            clientData.put("js_sdk_data", jsSdk);

            JSONObject root = new JSONObject();
            root.put("client_data", clientData);

            Request req = new Request.Builder()
                    .url("https://clienttoken.spotify.com/v1/clienttoken")
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .post(RequestBody.create(root.toString(), JSON_MEDIA))
                    .build();

            HttpResult res = executeWithRetry(req, 2, 6);
            if (res.code >= 200 && res.code < 300) {
                JSONObject json = new JSONObject(res.body);
                JSONObject granted = json.optJSONObject("granted_token");
                if (granted != null) {
                    String ct = granted.optString("token", "");
                    long expiresAfterSec = granted.optLong("expires_after_seconds", 86400);
                    if (!ct.isEmpty()) {
                        prefs.edit()
                                .putString(KEY_CLIENT_TOKEN, ct)
                                .putLong(KEY_CLIENT_TOKEN_EXPIRES, now + expiresAfterSec * 1000L)
                                .apply();
                        return ct;
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "clienttoken fetch failed (non-fatal): " + e.getMessage());
        }
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getString(KEY_CLIENT_TOKEN, "");
        }
        return "";
    }

    private static String getCachedClientToken() {
        if (appContext == null) return "";
        SharedPreferences prefs = appContext.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_CLIENT_TOKEN, "");
    }

    /**
     * Obtains an Access Token + Client Token from Spotify Web Player using the official TOTP signature
     * over HTTP/2 OkHttp with automatic retry on transient TLS EOF resets.
     */
    public static void getAccessToken(Context context, ApiCallback callback) {
        executor.execute(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
                String spDc = prefs.getString(SpotifyLoginActivity.KEY_SP_DC, null);
                boolean hasSpDc = spDc != null && !spDc.trim().isEmpty();

                long nowMs = System.currentTimeMillis();
                long serverTimeMs = getServerTime();

                String lastError = "Token fetch failed";
                for (String[] secretPair : TOTP_SECRETS) {
                    byte[] key = unmaskTotpSecret(secretPair[0]);
                    int version = Integer.parseInt(secretPair[1]);
                    String totpNow = computeTotp(key, nowMs);
                    String totpServer = computeTotp(key, serverTimeMs);

                    String query = "reason=init&productType=web_player" +
                            "&totp=" + totpNow +
                            "&totpServer=" + totpServer +
                            "&totpVer=" + version;

                    Request.Builder rb = new Request.Builder()
                            .url("https://open.spotify.com/api/token?" + query)
                            .header("User-Agent", USER_AGENT)
                            .header("Referer", "https://open.spotify.com/")
                            .header("Accept", "application/json")
                            .get();

                    if (hasSpDc) {
                        rb.header("Cookie", "sp_dc=" + spDc.trim());
                    }

                    HttpResult res = executeWithRetry(rb.build(), 3, 12);
                    if (res.code >= 200 && res.code < 300) {
                        JSONObject json = new JSONObject(res.body);
                        String token = json.optString("accessToken", "");
                        String clientId = json.optString("clientId", "");
                        boolean isAnon = json.optBoolean("isAnonymous", !hasSpDc);
                        long expires = json.optLong("accessTokenExpirationTimestampMs", System.currentTimeMillis() + 1800_000L);

                        // Non-fatal client-token fetch (matches desktop anon.go)
                        String clientToken = getOrFetchClientToken(context, clientId);
                        if (clientToken != null && !clientToken.isEmpty()) {
                            json.put("clientToken", clientToken);
                        }

                        if (!token.isEmpty()) {
                            if (!hasSpDc || !isAnon) {
                                prefs.edit()
                                        .putString(SpotifyLoginActivity.KEY_ACCESS_TOKEN, token)
                                        .putBoolean(KEY_ACCESS_TOKEN_ANON, isAnon)
                                        .putLong(KEY_ACCESS_TOKEN_EXPIRES, expires)
                                        .commit();
                            }
                        }
                        android.util.Log.d(TAG, "getAccessToken OK: hasSpDc=" + hasSpDc + " isAnon=" + isAnon + " hasClientToken=" + (!clientToken.isEmpty()));
                        String finalBody = json.toString();
                        mainHandler.post(() -> callback.onSuccess(finalBody));
                        return;
                    } else {
                        lastError = "Token fetch failed (" + res.code + ", ver=" + version + "): " + res.body;
                        android.util.Log.w(TAG, lastError);
                    }
                }
                final String finalErr = lastError;
                mainHandler.post(() -> callback.onError(new Exception(finalErr)));
            } catch (Exception e) {
                android.util.Log.e(TAG, "getAccessToken exception", e);
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Executes a Pathfinder GraphQL query over HTTP/2 OkHttp with automatic retry on TLS resets.
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

                Request.Builder rb = new Request.Builder()
                        .url("https://api-partner.spotify.com/pathfinder/v2/query")
                        .header("User-Agent", USER_AGENT)
                        .header("Accept", "application/json")
                        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                        .header("app-platform", "WebPlayer")
                        .post(RequestBody.create(payload.toString(), JSON_MEDIA));

                if (token != null && !token.isEmpty()) {
                    rb.header("Authorization", "Bearer " + token);
                }
                String ct = getCachedClientToken();
                if (ct != null && !ct.isEmpty()) {
                    rb.header("client-token", ct);
                }

                HttpResult res = executeWithRetry(rb.build(), 3, 15);
                if (res.code >= 200 && res.code < 300) {
                    mainHandler.post(() -> callback.onSuccess(res.body));
                } else {
                    android.util.Log.w(TAG, "Pathfinder " + operationName + " HTTP " + res.code + ": " + res.body);
                    mainHandler.post(() -> callback.onError(new Exception("Pathfinder " + res.code + ": " + res.body)));
                }
            } catch (Exception e) {
                android.util.Log.e(TAG, "Pathfinder " + operationName + " exception: " + e.getMessage());
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Executes a GET request against spclient.wg.spotify.com over HTTP/2 OkHttp with retry.
     */
    public static void fetchSpClient(String path, String token, ApiCallback callback) {
        executor.execute(() -> {
            try {
                Request.Builder rb = new Request.Builder()
                        .url("https://spclient.wg.spotify.com" + path)
                        .header("User-Agent", USER_AGENT)
                        .header("Accept", "application/json")
                        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                        .header("app-platform", "WebPlayer")
                        .get();

                if (token != null && !token.isEmpty()) {
                    rb.header("Authorization", "Bearer " + token);
                }
                String ct = getCachedClientToken();
                if (ct != null && !ct.isEmpty()) {
                    rb.header("client-token", ct);
                }

                HttpResult res = executeWithRetry(rb.build(), 3, 15);
                if (res.code >= 200 && res.code < 300) {
                    mainHandler.post(() -> callback.onSuccess(res.body));
                } else {
                    mainHandler.post(() -> callback.onError(new Exception("spclient " + res.code + ": " + res.body)));
                }
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Synchronously returns the current valid Spotify Identity (accessToken + clientToken),
     * renewing via /api/token if expired or forceRenew == true.
     */
    public static synchronized Identity getIdentitySync(Context context, boolean forceRenew) throws IOException {
        Context ctx = context != null ? context.getApplicationContext() : appContext;
        if (ctx == null) throw new IOException("Context not initialized");
        SharedPreferences prefs = ctx.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        String spDc = prefs.getString(SpotifyLoginActivity.KEY_SP_DC, null);
        boolean hasSpDc = spDc != null && !spDc.trim().isEmpty();

        if (!forceRenew) {
            String cachedToken = prefs.getString(SpotifyLoginActivity.KEY_ACCESS_TOKEN, "");
            boolean isAnon = prefs.getBoolean(KEY_ACCESS_TOKEN_ANON, true);
            long expires = prefs.getLong(KEY_ACCESS_TOKEN_EXPIRES, 0);
            String ct = prefs.getString(KEY_CLIENT_TOKEN, "");
            if (cachedToken != null && !cachedToken.isEmpty()
                    && (!hasSpDc || !isAnon)
                    && (expires == 0 || System.currentTimeMillis() < expires - 60_000L)) {
                return new Identity(cachedToken, ct != null ? ct : "", isAnon);
            }
        }

        long nowMs = System.currentTimeMillis();
        long serverTimeMs = getServerTime();
        String lastError = "Token renew failed";
        for (String[] secretPair : TOTP_SECRETS) {
            byte[] key = unmaskTotpSecret(secretPair[0]);
            int version = Integer.parseInt(secretPair[1]);
            String totpNow = computeTotp(key, nowMs);
            String totpServer = computeTotp(key, serverTimeMs);

            String query = "reason=init&productType=web_player" +
                    "&totp=" + totpNow +
                    "&totpServer=" + totpServer +
                    "&totpVer=" + version;

            Request.Builder rb = new Request.Builder()
                    .url("https://open.spotify.com/api/token?" + query)
                    .header("User-Agent", USER_AGENT)
                    .header("Referer", "https://open.spotify.com/")
                    .header("Accept", "application/json")
                    .get();

            if (hasSpDc) {
                rb.header("Cookie", "sp_dc=" + spDc.trim());
            }

            HttpResult res = executeWithRetry(rb.build(), 3, 12);
            if (res.code >= 200 && res.code < 300) {
                try {
                    JSONObject json = new JSONObject(res.body);
                    String token = json.optString("accessToken", "");
                    String clientId = json.optString("clientId", "");
                    boolean isAnon = json.optBoolean("isAnonymous", !hasSpDc);
                    long expires = json.optLong("accessTokenExpirationTimestampMs", System.currentTimeMillis() + 1800_000L);
                    String clientToken = getOrFetchClientToken(ctx, clientId);
                    if (!token.isEmpty() && (!hasSpDc || !isAnon)) {
                        prefs.edit()
                                .putString(SpotifyLoginActivity.KEY_ACCESS_TOKEN, token)
                                .putBoolean(KEY_ACCESS_TOKEN_ANON, isAnon)
                                .putLong(KEY_ACCESS_TOKEN_EXPIRES, expires)
                                .commit();
                    }
                    return new Identity(token, clientToken, isAnon);
                } catch (Exception je) {
                    lastError = "Token parse failed: " + je.getMessage();
                }
            } else {
                lastError = "Token HTTP " + res.code + " (ver=" + version + ")";
            }
        }
        throw new IOException(lastError);
    }

    private static RawHttpResult spClientGetSync(Context ctx, String path, String accept) throws IOException {
        for (int attempt = 0; attempt < 2; attempt++) {
            Identity id = getIdentitySync(ctx, attempt > 0);
            Request.Builder rb = new Request.Builder()
                    .url("https://spclient.wg.spotify.com" + path)
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", accept)
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .header("app-platform", "WebPlayer")
                    .header("Referer", "https://open.spotify.com/")
                    .get();
            if (!id.accessToken.isEmpty()) {
                rb.header("Authorization", "Bearer " + id.accessToken);
            }
            if (!id.clientToken.isEmpty()) {
                rb.header("client-token", id.clientToken);
            }
            RawHttpResult res = executeRawWithRetry(rb.build(), 3, 15);
            if (res.code == 401 && attempt == 0) {
                android.util.Log.w(TAG, "spclient " + path + " returned 401, renewing token");
                continue;
            }
            return res;
        }
        throw new IOException("spclient unauthorized");
    }

    /**
     * Exact Android port of upstream internal/spotify/media.go:ResolveMedia + media_other.go.
     * Resolves an official Spotify track or podcast episode into an HLS Widevine manifest (or external file URL).
     */
    public static void resolveSpotifyMedia(Context context, String uri, boolean preferHighQuality, boolean forceLowestBitrate, MediaCallback callback) {
        executor.execute(() -> {
            try {
                if (uri == null || uri.trim().isEmpty()) {
                    throw new IOException("Empty Spotify URI");
                }
                boolean isEpisode = uri.startsWith("spotify:episode:");
                String query = "manifestFileFormat=file_ids_mp4&manifestFileFormat=file_ids_mp4_dual";
                if (isEpisode) {
                    query += "&manifestFileFormat=file_urls_external";
                }
                RawHttpResult raw = spClientGetSync(context, "/track-playback/v1/media/" + uri + "?" + query, "application/json");
                if (raw.code < 200 || raw.code >= 300) {
                    String preview = new String(raw.body, StandardCharsets.UTF_8);
                    if (preview.length() > 200) preview = preview.substring(0, 200);
                    throw new IOException("track-playback HTTP " + raw.code + ": " + preview);
                }

                JSONObject root = new JSONObject(new String(raw.body, StandardCharsets.UTF_8));
                JSONObject mediaMap = root.optJSONObject("media");
                if (mediaMap == null) throw new IOException("track-playback: empty media map");

                JSONObject entry = mediaMap.optJSONObject(uri);
                if (entry == null) {
                    java.util.Iterator<String> keys = mediaMap.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        JSONObject cand = mediaMap.optJSONObject(k);
                        if (cand != null) {
                            JSONObject it = cand.optJSONObject("item");
                            String tt = it != null ? it.optString("track_type", "") : "";
                            if (!"VIDEO".equals(tt)) {
                                entry = cand;
                                break;
                            }
                        }
                    }
                }
                if (entry == null) throw new IOException("track-playback: no media entry for " + uri);

                JSONObject item = entry.optJSONObject("item");
                if (item == null) throw new IOException("track-playback: missing item");
                JSONObject meta = item.optJSONObject("metadata");
                long durationMs = meta != null ? meta.optLong("duration", 0) : 0;
                JSONObject manifestObj = item.optJSONObject("manifest");
                if (manifestObj == null) throw new IOException("track-playback: missing manifest");

                class FileCand {
                    String fileId;
                    int bitrate;
                }
                List<FileCand> candidates = new ArrayList<>();
                String[] formats = new String[]{"file_ids_mp4", "file_ids_mp4_dual"};
                for (String fmt : formats) {
                    JSONArray arr = manifestObj.optJSONArray(fmt);
                    if (arr == null) continue;
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject f = arr.optJSONObject(i);
                        if (f == null) continue;
                        String tt = f.optString("track_type", "");
                        String fid = f.optString("file_id", "");
                        if ((tt.isEmpty() || "AUDIO".equals(tt)) && !fid.isEmpty()) {
                            FileCand c = new FileCand();
                            c.fileId = fid;
                            c.bitrate = f.optInt("bitrate", 0);
                            candidates.add(c);
                        }
                    }
                    if (!candidates.isEmpty()) break;
                }

                // Podcast external audio fallback
                if (candidates.isEmpty() && isEpisode) {
                    JSONArray extArr = manifestObj.optJSONArray("file_urls_external");
                    if (extArr != null) {
                        for (int i = 0; i < extArr.length(); i++) {
                            JSONObject f = extArr.optJSONObject(i);
                            String fileUrl = f != null ? f.optString("file_url", "") : "";
                            if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
                                SpotifyMedia out = new SpotifyMedia("", fileUrl, "", durationMs, 0);
                                android.util.Log.i(TAG, "Resolved external episode audio: " + uri);
                                mainHandler.post(() -> callback.onSuccess(out));
                                return;
                            }
                        }
                    }
                }

                if (candidates.isEmpty()) {
                    throw new IOException("track-playback: no MP4 audio files for " + uri);
                }

                candidates.sort((a, b) -> Integer.compare(a.bitrate, b.bitrate));
                FileCand chosen = (preferHighQuality && !forceLowestBitrate)
                        ? candidates.get(candidates.size() - 1)
                        : candidates.get(0);

                RawHttpResult hlsRes = spClientGetSync(
                        context,
                        "/sneaktables/v2/hls/1/" + chosen.fileId + "/audio.m3u8",
                        "application/vnd.apple.mpegurl"
                );
                if (hlsRes.code < 200 || hlsRes.code >= 300) {
                    throw new IOException("sneaktables HLS HTTP " + hlsRes.code);
                }
                String m3u8 = new String(hlsRes.body, StandardCharsets.UTF_8);
                android.util.Log.i(TAG, "Resolved Spotify HLS: uri=" + uri + " fileId=" + chosen.fileId + " bitrate=" + chosen.bitrate + " len=" + m3u8.length());
                SpotifyMedia media = new SpotifyMedia(m3u8, "", chosen.fileId, durationMs, chosen.bitrate);
                mainHandler.post(() -> callback.onSuccess(media));
            } catch (Exception e) {
                android.util.Log.e(TAG, "resolveSpotifyMedia failed (" + uri + "): " + e.getMessage());
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Exact port of upstream internal/spotify/mirrors.go:Mirrors.
     * Returns alternate signed CDN URLs for a 40-char hex Spotify fileId.
     */
    public static List<String> getCdnMirrorsSync(Context context, String fileId) {
        if (fileId == null || fileId.length() != 40) return java.util.Collections.emptyList();
        String key = fileId.toLowerCase(Locale.US);
        MirrorEntry cached = mirrorCache.get(key);
        long now = System.currentTimeMillis();
        if (cached != null && (now - cached.fetchedAtMs) < MIRROR_TTL_MS) {
            return cached.urls;
        }
        try {
            String path = "/storage-resolve/v2/files/audio/interactive/10/" + key
                    + "?version=10000000&product=9&platform=39&alt=json";
            RawHttpResult res = spClientGetSync(context, path, "application/json");
            if (res.code >= 200 && res.code < 300) {
                JSONObject json = new JSONObject(new String(res.body, StandardCharsets.UTF_8));
                JSONArray arr = json.optJSONArray("cdnurl");
                if (arr != null && arr.length() > 0) {
                    List<String> urls = new ArrayList<>();
                    for (int i = 0; i < arr.length(); i++) {
                        String u = arr.optString(i, "");
                        if (!u.isEmpty()) urls.add(u);
                    }
                    if (!urls.isEmpty()) {
                        mirrorCache.put(key, new MirrorEntry(urls, now));
                        return urls;
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "getCdnMirrorsSync failed for " + key + ": " + e.getMessage());
        }
        return java.util.Collections.emptyList();
    }

    /**
     * Fallback audio preview resolver (used only in guest mode or when Spotify DRM stream is unavailable).
     * Uses global unblocked Apple iTunes Search API instead of broken NetEase outer/url 404.
     */
    public static void resolveAudioUrl(String title, String artist, ApiCallback callback) {
        executor.execute(() -> {
            try {
                String primaryArtist = artist != null && !artist.isEmpty() ? artist.split(",")[0].trim() : "";
                String query = (title != null ? title : "") + (primaryArtist.isEmpty() ? "" : " " + primaryArtist);
                String url = "https://itunes.apple.com/search?term=" + URLEncoder.encode(query.trim(), "UTF-8")
                        + "&media=music&entity=song&limit=5";
                Request req = new Request.Builder()
                        .url(url)
                        .header("User-Agent", USER_AGENT)
                        .header("Accept", "application/json")
                        .get()
                        .build();
                HttpResult res = executeWithRetry(req, 2, 10);
                if (res.code == 200) {
                    JSONObject json = new JSONObject(res.body);
                    JSONArray results = json.optJSONArray("results");
                    if (results != null && results.length() > 0) {
                        for (int i = 0; i < results.length(); i++) {
                            JSONObject item = results.optJSONObject(i);
                            String previewUrl = item != null ? item.optString("previewUrl", "") : "";
                            if (previewUrl.startsWith("http")) {
                                JSONObject out = new JSONObject();
                                out.put("audioUrl", previewUrl);
                                out.put("source", "itunes_preview");
                                android.util.Log.i(TAG, "Resolved fallback iTunes preview for: " + query);
                                mainHandler.post(() -> callback.onSuccess(out.toString()));
                                return;
                            }
                        }
                    }
                }
                mainHandler.post(() -> callback.onError(new Exception("No matching preview stream found")));
            } catch (Exception e) {
                android.util.Log.w(TAG, "resolveAudioUrl fallback failed: " + e.getMessage());
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
