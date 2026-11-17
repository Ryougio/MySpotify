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
        prefs.edit().remove(SpotifyLoginActivity.KEY_SP_DC).apply();
        activity.runOnUiThread(() -> {
            showToast("已退出登录，恢复访客模式");
            webView.evaluateJavascript("if (window.onNativeLoginSuccess) window.onNativeLoginSuccess(false);", null);
        });
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
    public void fetchWebApi(String path, String token, String method, String body, String callbackFn) {
        SpotifyApiClient.fetchWebApi(path, token, method, body, new SpotifyApiClient.ApiCallback() {
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
                    String escaped = JSONObject.quote(error.getMessage() != null ? error.getMessage() : "Request failed");
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
