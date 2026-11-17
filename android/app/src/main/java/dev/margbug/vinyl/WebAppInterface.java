package dev.margbug.vinyl;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import org.json.JSONObject;

public class WebAppInterface {
    private final MainActivity activity;
    private final WebView webView;

    public WebAppInterface(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void startSpotifyLogin() {
        activity.launchSpotifyLogin();
    }

    @JavascriptInterface
    public void logout() {
        SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .remove(SpotifyLoginActivity.KEY_SP_DC)
                .remove(SpotifyLoginActivity.KEY_ALL_COOKIES)
                .remove(SpotifyLoginActivity.KEY_ACCESS_TOKEN)
                .apply();
        activity.runOnUiThread(() -> {
            showToast("已退出登录，恢复访客模式");
            webView.evaluateJavascript("if (window.onNativeLoginSuccess) window.onNativeLoginSuccess(false);", null);
        });
    }

    @JavascriptInterface
    public String getSavedAccessToken() {
        SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(SpotifyLoginActivity.KEY_ACCESS_TOKEN, "");
    }

    @JavascriptInterface
    public void setProxy(String proxy) {
        SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("proxy", proxy != null ? proxy.trim() : "").apply();
    }

    @JavascriptInterface
    public String getProxy() {
        SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString("proxy", "");
    }

    @JavascriptInterface
    public String getLoginStatus() {
        SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        String spDc = prefs.getString(SpotifyLoginActivity.KEY_SP_DC, null);
        JSONObject res = new JSONObject();
        try {
            res.put("isLoggedIn", spDc != null && !spDc.isEmpty());
            res.put("isGuest", spDc == null || spDc.isEmpty());
        } catch (Exception ignored) {}
        return res.toString();
    }

    @JavascriptInterface
    public boolean setSpDc(String spDc) {
        if (spDc == null || spDc.trim().isEmpty()) return false;
        String clean = spDc.trim();
        if (clean.contains("sp_dc=")) {
            clean = clean.substring(clean.indexOf("sp_dc=") + 6);
            if (clean.contains(";")) {
                clean = clean.substring(0, clean.indexOf(";"));
            }
            clean = clean.trim();
        }
        if (clean.isEmpty()) return false;

        SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(SpotifyLoginActivity.KEY_SP_DC, clean)
                .putString(SpotifyLoginActivity.KEY_ALL_COOKIES, "sp_dc=" + clean + "; Domain=.spotify.com; Path=/")
                .apply();
        activity.runOnUiThread(() -> {
            showToast("Cookie 导入成功，正在同步账号...");
            webView.evaluateJavascript("if (window.onNativeLoginSuccess) window.onNativeLoginSuccess(true);", null);
        });
        return true;
    }

    @JavascriptInterface
    public void fetchAccessToken(String callbackFn) {
        SpotifyApiClient.getAccessToken(activity, new SpotifyApiClient.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(response);
                    webView.evaluateJavascript(callbackFn + "(null, " + escaped + ")", null);
                });
            }

            @Override
            public void onError(Exception error) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "Unknown error");
                    webView.evaluateJavascript(callbackFn + "(" + escaped + ", null)", null);
                });
            }
        });
    }

    @JavascriptInterface
    public void fetchPathfinder(String operationName, String hash, String variablesJson, String token, String callbackFn) {
        try {
            JSONObject vars = (variablesJson != null && !variablesJson.isEmpty()) ? new JSONObject(variablesJson) : new JSONObject();
            SpotifyApiClient.fetchPathfinder(operationName, hash, vars, token, new SpotifyApiClient.ApiCallback() {
                @Override
                public void onSuccess(String response) {
                    activity.runOnUiThread(() -> {
                        String escaped = JSONObject.quote(response);
                        webView.evaluateJavascript(callbackFn + "(null, " + escaped + ")", null);
                    });
                }

                @Override
                public void onError(Exception error) {
                    activity.runOnUiThread(() -> {
                        String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "Pathfinder failed");
                        webView.evaluateJavascript(callbackFn + "(" + escaped + ", null)", null);
                    });
                }
            });
        } catch (Exception e) {
            activity.runOnUiThread(() -> {
                String escaped = JSONObject.quote(e.getMessage() != null ? e.getMessage() : "Variables parse failed");
                webView.evaluateJavascript(callbackFn + "(" + escaped + ", null)", null);
            });
        }
    }

    @JavascriptInterface
    public void fetchSpClient(String path, String token, String callbackFn) {
        SpotifyApiClient.fetchSpClient(path, token, new SpotifyApiClient.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(response);
                    webView.evaluateJavascript(callbackFn + "(null, " + escaped + ")", null);
                });
            }

            @Override
            public void onError(Exception error) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "spclient failed");
                    webView.evaluateJavascript(callbackFn + "(" + escaped + ", null)", null);
                });
            }
        });
    }

    @JavascriptInterface
    public void fetchLyrics(String trackId, String title, String artist, long durationSec, String callbackFn) {
        SpotifyApiClient.fetchLyrics(trackId, title, artist, durationSec, new SpotifyApiClient.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(response);
                    webView.evaluateJavascript(callbackFn + "(null, " + escaped + ")", null);
                });
            }

            @Override
            public void onError(Exception error) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "Failed to load lyrics");
                    webView.evaluateJavascript(callbackFn + "(" + escaped + ", null)", null);
                });
            }
        });
    }

    @JavascriptInterface
    public void resolveAudioUrl(String title, String artist, String callbackFn) {
        SpotifyApiClient.resolveAudioUrl(title, artist, new SpotifyApiClient.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(response);
                    webView.evaluateJavascript(callbackFn + "(null, " + escaped + ")", null);
                });
            }

            @Override
            public void onError(Exception error) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "Audio resolution failed");
                    webView.evaluateJavascript(callbackFn + "(" + escaped + ", null)", null);
                });
            }
        });
    }

    @JavascriptInterface
    public void getCacheSize(String callbackFn) {
        SpotifyApiClient.getCacheSize(activity, new SpotifyApiClient.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(response);
                    webView.evaluateJavascript(callbackFn + "(null, " + escaped + ")", null);
                });
            }

            @Override
            public void onError(Exception error) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "Failed to calculate cache");
                    webView.evaluateJavascript(callbackFn + "(" + escaped + ", null)", null);
                });
            }
        });
    }

    @JavascriptInterface
    public void clearCache(String callbackFn) {
        SpotifyApiClient.clearCache(activity, new SpotifyApiClient.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                activity.runOnUiThread(() -> {
                    webView.evaluateJavascript(callbackFn + "(null, true)", null);
                });
            }

            @Override
            public void onError(Exception error) {
                activity.runOnUiThread(() -> {
                    String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "Failed to clear cache");
                    webView.evaluateJavascript(callbackFn + "(" + escaped + ", false)", null);
                });
            }
        });
    }

    @JavascriptInterface
    public void playTrack(String url, String title, String artist, String album, String coverUrl) {
        if (url == null || url.isEmpty() || url.equals("null") || url.startsWith("resolve:")) {
            SpotifyApiClient.resolveAudioUrl(title, artist, new SpotifyApiClient.ApiCallback() {
                @Override
                public void onSuccess(String response) {
                    try {
                        JSONObject obj = new JSONObject(response);
                        String resolvedUrl = obj.optString("audioUrl", null);
                        if (resolvedUrl != null && !resolvedUrl.isEmpty()) {
                            startPlayIntent(resolvedUrl, title, artist, album, coverUrl);
                        } else {
                            startPlayIntent("https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3", title, artist, album, coverUrl);
                        }
                    } catch (Exception e) {
                        startPlayIntent("https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3", title, artist, album, coverUrl);
                    }
                }

                @Override
                public void onError(Exception error) {
                    startPlayIntent("https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3", title, artist, album, coverUrl);
                }
            });
            return;
        }
        startPlayIntent(url, title, artist, album, coverUrl);
    }

    private void startPlayIntent(String url, String title, String artist, String album, String coverUrl) {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_PLAY);
        intent.putExtra("url", url);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("coverUrl", coverUrl);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.startForegroundService(intent);
        } else {
            activity.startService(intent);
        }
    }

    @JavascriptInterface
    public void setStatusBarTheme(boolean dark) {
        activity.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.view.Window window = activity.getWindow();
                android.view.View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                if (dark) {
                    flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    window.setStatusBarColor(android.graphics.Color.parseColor("#141416"));
                    window.setNavigationBarColor(android.graphics.Color.parseColor("#141416"));
                } else {
                    flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    window.setStatusBarColor(android.graphics.Color.parseColor("#f5f5f7"));
                    window.setNavigationBarColor(android.graphics.Color.parseColor("#ffffff"));
                }
                decor.setSystemUiVisibility(flags);
            }
        });
    }

    @JavascriptInterface
    public void pauseTrack() {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_PAUSE);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void resumeTrack() {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_RESUME);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void seekTo(int positionMs) {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_SEEK);
        intent.putExtra("positionMs", positionMs);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void setEqualizer(boolean enabled, String gainsJson) {
        try {
            float[] gains = new float[]{0f, 0f, 0f, 0f, 0f, 0f};
            if (gainsJson != null && !gainsJson.isEmpty()) {
                org.json.JSONArray arr = new org.json.JSONArray(gainsJson);
                for (int i = 0; i < Math.min(6, arr.length()); i++) {
                    gains[i] = (float) arr.optDouble(i, 0.0);
                }
            }
            SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                    .putBoolean("eq_enabled", enabled)
                    .putString("eq_gains", gainsJson != null ? gainsJson : "[0,0,0,0,0,0]")
                    .apply();

            Intent intent = new Intent(activity, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_SET_EQ);
            intent.putExtra("enabled", enabled);
            intent.putExtra("gains", gains);
            activity.startService(intent);
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public String getEqualizer() {
        try {
            SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
            JSONObject obj = new JSONObject();
            obj.put("enabled", prefs.getBoolean("eq_enabled", false));
            obj.put("gains", new org.json.JSONArray(prefs.getString("eq_gains", "[0,0,0,0,0,0]")));
            return obj.toString();
        } catch (Exception e) {
            return "{\"enabled\":false,\"gains\":[0,0,0,0,0,0]}";
        }
    }

    @JavascriptInterface
    public void setPlaybackSpeed(float speed) {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_SET_SPEED);
        intent.putExtra("speed", speed);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void stopPlaybackService() {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_STOP);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void showToast(String message) {
        activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface
    public void vibrate(int milliseconds) {
        try {
            Vibrator vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(milliseconds);
                }
            }
        } catch (Exception ignored) {}
    }

    public void cleanup() {
        stopPlaybackService();
    }
}
