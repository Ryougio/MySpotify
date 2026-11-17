package dev.margbug.vinyl;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SpotifyApiClient {

    private static final String TAG = "SpotifyApiClient";
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    private static final ExecutorService executor = Executors.newCachedThreadPool();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface ApiCallback {
        void onSuccess(String response);
        void onError(Exception error);
    }

    /**
     * Obtains an Access Token from Spotify Web Player.
     * Uses saved sp_dc cookie if present, otherwise returns anonymous guest token.
     */
    public static void getAccessToken(Context context, ApiCallback callback) {
        executor.execute(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
                String spDc = prefs.getString(SpotifyLoginActivity.KEY_SP_DC, null);

                URL url = new URL("https://open.spotify.com/get_access_token?reason=transport&productType=web-player");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", USER_AGENT);
                conn.setRequestProperty("Accept", "application/json");

                if (spDc != null && !spDc.isEmpty()) {
                    conn.setRequestProperty("Cookie", "sp_dc=" + spDc);
                }

                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                int code = conn.getResponseCode();
                if (code >= 200 && code < 300) {
                    String body = readStream(conn.getInputStream());
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
     * Proxies a request to the official Spotify Web API with the given Bearer token.
     */
    public static void fetchWebApi(String path, String token, String method, String body, ApiCallback callback) {
        executor.execute(() -> {
            try {
                String fullUrl = path.startsWith("http") ? path : "https://api.spotify.com/v1/" + (path.startsWith("/") ? path.substring(1) : path);
                URL url = new URL(fullUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setRequestProperty("User-Agent", USER_AGENT);
                conn.setRequestProperty("Accept", "application/json");
                if (token != null && !token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                if ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json");
                    if (body != null && !body.isEmpty()) {
                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(body.getBytes(StandardCharsets.UTF_8));
                        }
                    }
                }

                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
                String res = readStream(is);
                if (code >= 200 && code < 300) {
                    mainHandler.post(() -> callback.onSuccess(res));
                } else {
                    mainHandler.post(() -> callback.onError(new Exception("HTTP " + code + ": " + res)));
                }
                conn.disconnect();
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Multi-source lyrics engine:
     * 1. LRCLIB (Accurate metadata match)
     * 2. NetEase Cloud Music (LRC with translated Chinese subtitle)
     */
    public static void fetchLyrics(String trackId, String title, String artist, long durationSec, ApiCallback callback) {
        executor.execute(() -> {
            try {
                // 1. Try LRCLIB
                String lrcJson = queryLrclib(title, artist, durationSec);
                if (lrcJson != null) {
                    mainHandler.post(() -> callback.onSuccess(lrcJson));
                    return;
                }

                // 2. Try NetEase Cloud Music
                String neteaseJson = queryNetEase(title, artist);
                if (neteaseJson != null) {
                    mainHandler.post(() -> callback.onSuccess(neteaseJson));
                    return;
                }

                // Empty fallback
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

                // Find matching translation line within 0.5s tolerance
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
