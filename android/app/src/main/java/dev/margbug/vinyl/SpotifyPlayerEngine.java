package dev.margbug.vinyl;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Official Spotify Widevine EME + HLS.js Playback Engine for Android.
 * Exact architectural counterpart of upstream internal/player/web.go + player.html.
 */
public class SpotifyPlayerEngine implements LocalMediaServer.EventListener {

    private static final String TAG = "SpotifyPlayerEngine";

    public interface UiCallback {
        void onPlaybackStateChanged(boolean isPlaying, int posMs, int durMs);
        void onTrackEnded();
        void onQualityChanged(String badgeText);
        void onPlaybackError(String message);
    }

    private final MainActivity activity;
    private final UiCallback uiCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final LocalMediaServer server;
    private WebView playerWebView;

    private volatile boolean pageReady = false;
    private final List<String> pendingJs = Collections.synchronizedList(new ArrayList<>());
    private final Set<String> downgradedUris = ConcurrentHashMap.newKeySet();
    private volatile boolean accountFreeOnly = false;
    private final AtomicInteger playRequestSeq = new AtomicInteger(0);

    private volatile int activeGen = 0;
    private volatile boolean activeIsPlaying = false;
    private volatile boolean activeHasStarted = false;
    private volatile int activePosMs = 0;
    private volatile int activeDurMs = 0;
    private volatile int activeBitrate = 0;
    private volatile float playbackSpeed = 1.0f;
    private volatile int crossfadeSec = 0;
    private volatile boolean usingNativeFallback = false;

    private String curUri = "";
    private String curTitle = "";
    private String curArtist = "";
    private String curAlbum = "";
    private String curCoverUrl = "";
    private Runnable startTimeoutRunnable;

    @SuppressLint("SetJavaScriptEnabled")
    public SpotifyPlayerEngine(MainActivity activity, FrameLayout hostContainer, UiCallback uiCallback) {
        this.activity = activity;
        this.uiCallback = uiCallback;
        this.server = new LocalMediaServer(activity, this);

        try {
            server.start();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start LocalMediaServer: " + e.getMessage(), e);
        }

        playerWebView = new WebView(activity);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(1, 1);
        playerWebView.setLayoutParams(lp);
        playerWebView.setAlpha(0f);
        playerWebView.setVisibility(View.INVISIBLE);
        hostContainer.addView(playerWebView, 0);

        WebSettings s = playerWebView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        playerWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                activity.runOnUiThread(() -> {
                    String origin = request.getOrigin() != null ? request.getOrigin().toString() : "";
                    if (origin.startsWith("http://127.0.0.1:")) {
                        Log.i(TAG, "Granting Widevine EME permission for " + origin);
                        request.grant(request.getResources());
                    } else {
                        request.deny();
                    }
                });
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d("VinylPlayerJS", cm.message() + " (L" + cm.lineNumber() + ")");
                return true;
            }
        });

        playerWebView.setWebViewClient(new WebViewClient());
        if (server.getPort() > 0) {
            playerWebView.loadUrl(server.getPlayerUrl());
        }
    }

    private void evalPlayerJs(String js) {
        if (!pageReady) {
            pendingJs.add(js);
            return;
        }
        mainHandler.post(() -> {
            if (playerWebView != null) {
                playerWebView.evaluateJavascript(js, null);
            }
        });
    }

    private boolean isLoggedIn() {
        SharedPreferences prefs = activity.getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        String spDc = prefs.getString(SpotifyLoginActivity.KEY_SP_DC, null);
        return spDc != null && !spDc.trim().isEmpty();
    }

    public void playSpotifyTrack(String uri, String title, String artist, String album, String coverUrl, long durationMs) {
        final int reqId = playRequestSeq.incrementAndGet();
        cancelStartTimeout();

        this.curUri = uri != null ? uri : "";
        this.curTitle = title != null ? title : "";
        this.curArtist = artist != null ? artist : "";
        this.curAlbum = album != null ? album : "";
        this.curCoverUrl = coverUrl != null ? coverUrl : "";
        this.activeDurMs = durationMs > 0 ? (int) durationMs : 0;
        this.activePosMs = 0;
        this.activeHasStarted = false;
        this.usingNativeFallback = false;

        // Immediately invalidate previous activeGen so stale error events from an aborted attempt never race
        int prevGen = this.activeGen;
        this.activeGen = 0;
        if (prevGen > 0 && crossfadeSec <= 0) {
            evalPlayerJs(String.format(Locale.US, "window.vinyl.unload(%d);", prevGen));
        }

        // Immediately sync foreground notification so Android 14+ foreground service starts cleanly
        syncForegroundService(true);

        boolean validSpotifyUri = curUri.startsWith("spotify:track:") || curUri.startsWith("spotify:episode:");
        if (isLoggedIn() && validSpotifyUri && server.getPort() > 0) {
            boolean forceLowest = accountFreeOnly || downgradedUris.contains(curUri);
            Log.i(TAG, "Resolving official Spotify stream: uri=" + curUri + " forceLowest=" + forceLowest);
            SpotifyApiClient.resolveSpotifyMedia(activity, curUri, !forceLowest, forceLowest, new SpotifyApiClient.MediaCallback() {
                @Override
                public void onSuccess(SpotifyApiClient.SpotifyMedia media) {
                    if (reqId != playRequestSeq.get()) return;
                    if (media.durationMs > 0) {
                        activeDurMs = (int) media.durationMs;
                    }
                    activeBitrate = media.bitrate;

                    if (media.fileUrl != null && !media.fileUrl.isEmpty()) {
                        // Direct external episode audio
                        LocalMediaServer.TrackSession session = server.registerDirectFile(media.fileUrl, activeDurMs);
                        startWebSession(session, true, reqId);
                        if (uiCallback != null) uiCallback.onQualityChanged("播客原音");
                    } else {
                        // Official Spotify encrypted HLS + Widevine EME
                        LocalMediaServer.TrackSession session = server.registerHlsTrack(media);
                        startWebSession(session, false, reqId);
                        String badge = media.bitrate >= 200000 ? "256k" : (media.bitrate > 0 ? (media.bitrate / 1000) + "k" : "AAC");
                        if (uiCallback != null) uiCallback.onQualityChanged(badge);
                    }
                }

                @Override
                public void onError(Exception error) {
                    if (reqId != playRequestSeq.get()) return;
                    String msg = error.getMessage() != null ? error.getMessage() : "unknown";
                    Log.w(TAG, "Official Spotify media failed (" + msg + "), falling back to preview resolver");
                    fallbackToPreview(reqId, msg);
                }
            });
        } else {
            Log.i(TAG, "Guest mode or non-Spotify URI, resolving preview for: " + curTitle);
            fallbackToPreview(reqId, "");
        }
    }

    private void startWebSession(LocalMediaServer.TrackSession session, boolean isFile, int reqId) {
        activeGen = session.gen;
        activeIsPlaying = true;
        activeHasStarted = false;
        usingNativeFallback = false;

        int lead = (!isFile && crossfadeSec > 0) ? crossfadeSec : 0;
        String kindArg = isFile ? "'file'" : "null";
        evalPlayerJs(String.format(Locale.US, "window.vinyl.load(%d, %s, %d);", session.gen, kindArg, lead));
        if (Math.abs(playbackSpeed - 1.0f) > 0.01f) {
            evalPlayerJs(String.format(Locale.US, "window.vinyl.rate(%d, %.2f);", session.gen, playbackSpeed));
        }
        evalPlayerJs(String.format(Locale.US, "window.vinyl.play(%d, 1);", session.gen));

        // 18-second watchdog in case Widevine DRM or CDN stalls silently
        startTimeoutRunnable = () -> {
            if (reqId == playRequestSeq.get() && activeGen == session.gen && activeIsPlaying && !activeHasStarted) {
                LocalMediaServer.TrackSession s = server.getSession(session.gen);
                int licCode = s != null ? s.lastLicenseCode : 0;
                Log.w(TAG, "Playback start timeout (gen=" + session.gen + ", licenseHttp=" + licCode + ")");
                if (licCode == 403 && !downgradedUris.contains(curUri) && activeBitrate > 128000) {
                    retryDowngradedBitrate(reqId);
                } else {
                    fallbackToPreview(reqId, "Widevine 启动超时 (license=" + licCode + ")");
                }
            }
        };
        mainHandler.postDelayed(startTimeoutRunnable, 18_000L);
    }

    private void retryDowngradedBitrate(int reqId) {
        if (curUri == null || curUri.isEmpty()) return;
        if (reqId != playRequestSeq.get()) return;
        Log.i(TAG, "License 403 on high bitrate, switching session to 128k (Free account) for " + curUri);
        accountFreeOnly = true;
        downgradedUris.add(curUri);
        int oldGen = activeGen;
        activeGen = 0;
        if (oldGen > 0) {
            evalPlayerJs(String.format(Locale.US, "window.vinyl.unload(%d);", oldGen));
        }
        playSpotifyTrack(curUri, curTitle, curArtist, curAlbum, curCoverUrl, activeDurMs);
    }

    private void fallbackToPreview(int reqId, String originalErr) {
        SpotifyApiClient.resolveAudioUrl(curTitle, curArtist, new SpotifyApiClient.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                if (reqId != playRequestSeq.get()) return;
                try {
                    JSONObject obj = new JSONObject(response);
                    String previewUrl = obj.optString("audioUrl", "");
                    if (previewUrl.startsWith("http")) {
                        if (uiCallback != null) uiCallback.onQualityChanged("试听");
                        playDirectUrl(previewUrl, curTitle, curArtist, curAlbum, curCoverUrl);
                        return;
                    }
                } catch (Exception ignored) {}
                reportFatalError(originalErr);
            }

            @Override
            public void onError(Exception error) {
                if (reqId != playRequestSeq.get()) return;
                reportFatalError(originalErr.isEmpty() ? error.getMessage() : originalErr);
            }
        });
    }

    private void reportFatalError(String rawErr) {
        activeIsPlaying = false;
        syncForegroundService(false);
        String msg;
        if (rawErr != null && rawErr.contains("connection closed")) {
            msg = "Spotify 音源连接被代理重置，请检查 FlClash 节点";
        } else if (rawErr != null && !rawErr.isEmpty()) {
            msg = "播放失败：" + rawErr;
        } else {
            msg = "暂无法播放该曲目，请检查网络或登录状态";
        }
        if (uiCallback != null) {
            uiCallback.onPlaybackStateChanged(false, 0, activeDurMs);
            uiCallback.onPlaybackError(msg);
        }
    }

    public void playDirectUrl(String url, String title, String artist, String album, String coverUrl) {
        cancelStartTimeout();
        if (activeGen > 0) {
            evalPlayerJs(String.format(Locale.US, "window.vinyl.unload(%d);", activeGen));
            activeGen = 0;
        }
        usingNativeFallback = true;
        this.curTitle = title != null ? title : "";
        this.curArtist = artist != null ? artist : "";
        this.curAlbum = album != null ? album : "";
        this.curCoverUrl = coverUrl != null ? coverUrl : "";

        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_PLAY);
        intent.putExtra("url", url);
        intent.putExtra("title", curTitle);
        intent.putExtra("artist", curArtist);
        intent.putExtra("album", curAlbum);
        intent.putExtra("coverUrl", curCoverUrl);
        startPlaybackService(intent);
    }

    public void pause() {
        cancelStartTimeout();
        if (usingNativeFallback) {
            Intent i = new Intent(activity, MediaPlaybackService.class);
            i.setAction(MediaPlaybackService.ACTION_PAUSE);
            activity.startService(i);
            return;
        }
        activeIsPlaying = false;
        if (activeGen > 0) {
            evalPlayerJs(String.format(Locale.US, "window.vinyl.pause(%d, 1);", activeGen));
        }
        syncForegroundService(false);
        if (uiCallback != null) {
            uiCallback.onPlaybackStateChanged(false, activePosMs, activeDurMs);
        }
    }

    public void resume() {
        if (usingNativeFallback) {
            Intent i = new Intent(activity, MediaPlaybackService.class);
            i.setAction(MediaPlaybackService.ACTION_RESUME);
            activity.startService(i);
            return;
        }
        if (activeGen > 0) {
            activeIsPlaying = true;
            evalPlayerJs(String.format(Locale.US, "window.vinyl.play(%d, 1);", activeGen));
            syncForegroundService(true);
            if (uiCallback != null) {
                uiCallback.onPlaybackStateChanged(true, activePosMs, activeDurMs);
            }
        }
    }

    public void seekTo(int posMs) {
        if (usingNativeFallback) {
            Intent i = new Intent(activity, MediaPlaybackService.class);
            i.setAction(MediaPlaybackService.ACTION_SEEK);
            i.putExtra("positionMs", posMs);
            activity.startService(i);
            return;
        }
        activePosMs = Math.max(0, posMs);
        if (activeGen > 0) {
            evalPlayerJs(String.format(Locale.US, "window.vinyl.seek(%d, %.3f);", activeGen, activePosMs / 1000.0));
        }
        syncForegroundService(activeIsPlaying);
        if (uiCallback != null) {
            uiCallback.onPlaybackStateChanged(activeIsPlaying, activePosMs, activeDurMs);
        }
    }

    public void setPlaybackSpeed(float speed) {
        this.playbackSpeed = Math.max(0.5f, Math.min(2.5f, speed));
        if (usingNativeFallback) {
            Intent i = new Intent(activity, MediaPlaybackService.class);
            i.setAction(MediaPlaybackService.ACTION_SET_SPEED);
            i.putExtra("speed", playbackSpeed);
            activity.startService(i);
            return;
        }
        if (activeGen > 0) {
            evalPlayerJs(String.format(Locale.US, "window.vinyl.rate(%d, %.2f);", activeGen, playbackSpeed));
        }
    }

    public void setEqualizer(boolean enabled, String gainsJson) {
        if (enabled && gainsJson != null && !gainsJson.isEmpty()) {
            evalPlayerJs("window.vinyl.eq(" + gainsJson + ");");
        } else {
            evalPlayerJs("window.vinyl.eq(null);");
        }
        // Also forward to native MediaPlayer in case fallback mode is active
        try {
            float[] gains = new float[]{0f, 0f, 0f, 0f, 0f, 0f};
            if (gainsJson != null && !gainsJson.isEmpty()) {
                org.json.JSONArray arr = new org.json.JSONArray(gainsJson);
                for (int i = 0; i < Math.min(6, arr.length()); i++) {
                    gains[i] = (float) arr.optDouble(i, 0.0);
                }
            }
            Intent intent = new Intent(activity, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_SET_EQ);
            intent.putExtra("enabled", enabled);
            intent.putExtra("gains", gains);
            activity.startService(intent);
        } catch (Exception ignored) {}
    }

    public void setCrossfade(int seconds) {
        this.crossfadeSec = Math.max(0, Math.min(12, seconds));
        evalPlayerJs(String.format(Locale.US, "window.vinyl.crossfade(%d);", this.crossfadeSec));
    }

    @Override
    public void onLicenseResponse(int gen, int httpCode) {
        if (gen == activeGen && httpCode == 403 && !accountFreeOnly && activeBitrate > 128000) {
            // Synchronously invalidate activeGen BEFORE returning HTTP 403 to hls.js
            // so the resulting hls.js keySystemError event is 100% ignored and never races with iTunes fallback!
            accountFreeOnly = true;
            downgradedUris.add(curUri);
            activeGen = 0;
            int reqId = playRequestSeq.get();
            mainHandler.post(() -> {
                if (reqId == playRequestSeq.get()) {
                    evalPlayerJs(String.format(Locale.US, "window.vinyl.unload(%d);", gen));
                    playSpotifyTrack(curUri, curTitle, curArtist, curAlbum, curCoverUrl, activeDurMs);
                }
            });
        }
    }

    @Override
    public void onPlayerEvent(int gen, String type, double timeSec, String msg, int seq) {
        if ("ready".equals(type)) {
            Log.i(TAG, "Hidden Widevine player ready (" + msg + ")");
            pageReady = true;
            List<String> toRun;
            synchronized (pendingJs) {
                toRun = new ArrayList<>(pendingJs);
                pendingJs.clear();
            }
            mainHandler.post(() -> {
                for (String js : toRun) {
                    if (playerWebView != null) playerWebView.evaluateJavascript(js, null);
                }
            });
            return;
        }

        if (gen != activeGen || usingNativeFallback) return;

        int posMs = (int) Math.round(timeSec * 1000.0);
        switch (type) {
            case "duration":
                if (posMs > 0) {
                    activeDurMs = posMs;
                    mainHandler.post(() -> {
                        if (uiCallback != null) uiCallback.onPlaybackStateChanged(activeIsPlaying, activePosMs, activeDurMs);
                    });
                }
                break;
            case "playing":
                cancelStartTimeout();
                activeIsPlaying = true;
                activeHasStarted = true;
                activePosMs = posMs;
                Log.i(TAG, "Widevine playback STARTED! gen=" + gen + " pos=" + posMs + "ms dur=" + activeDurMs + "ms");
                mainHandler.post(() -> {
                    syncForegroundService(true);
                    if (uiCallback != null) uiCallback.onPlaybackStateChanged(true, activePosMs, activeDurMs);
                });
                break;
            case "time":
                if (posMs > 0) {
                    activeHasStarted = true;
                    cancelStartTimeout();
                }
                activePosMs = posMs;
                mainHandler.post(() -> {
                    if (uiCallback != null) uiCallback.onPlaybackStateChanged(activeIsPlaying, activePosMs, activeDurMs);
                });
                break;
            case "pause":
                activeIsPlaying = false;
                activePosMs = posMs;
                mainHandler.post(() -> {
                    syncForegroundService(false);
                    if (uiCallback != null) uiCallback.onPlaybackStateChanged(false, activePosMs, activeDurMs);
                });
                break;
            case "ended":
                cancelStartTimeout();
                activeIsPlaying = false;
                mainHandler.post(() -> {
                    if (uiCallback != null) uiCallback.onTrackEnded();
                });
                break;
            case "retry":
                Log.w(TAG, "Widevine player retry (gen=" + gen + "): " + msg);
                break;
            case "error":
                cancelStartTimeout();
                Log.e(TAG, "Widevine player ERROR (gen=" + gen + "): " + msg);
                LocalMediaServer.TrackSession s = server.getSession(gen);
                int licCode = s != null ? s.lastLicenseCode : 0;
                int reqId = playRequestSeq.get();
                mainHandler.post(() -> {
                    if (gen != activeGen) return;
                    if (licCode == 403 && activeBitrate > 128000 && !downgradedUris.contains(curUri)) {
                        retryDowngradedBitrate(reqId);
                    } else {
                        fallbackToPreview(reqId, msg);
                    }
                });
                break;
        }
    }

    private void syncForegroundService(boolean playing) {
        try {
            Intent intent = new Intent(activity, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_SYNC_WEB_STATE);
            intent.putExtra("title", curTitle);
            intent.putExtra("artist", curArtist);
            intent.putExtra("album", curAlbum);
            intent.putExtra("coverUrl", curCoverUrl);
            intent.putExtra("isPlaying", playing);
            intent.putExtra("positionMs", activePosMs);
            intent.putExtra("durationMs", activeDurMs);
            startPlaybackService(intent);
        } catch (Exception e) {
            Log.w(TAG, "syncForegroundService error: " + e.getMessage());
        }
    }

    private void startPlaybackService(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.startForegroundService(intent);
        } else {
            activity.startService(intent);
        }
    }

    private void cancelStartTimeout() {
        if (startTimeoutRunnable != null) {
            mainHandler.removeCallbacks(startTimeoutRunnable);
            startTimeoutRunnable = null;
        }
    }

    public void destroy() {
        cancelStartTimeout();
        server.stop();
        if (playerWebView != null) {
            try {
                ViewGroup parent = (ViewGroup) playerWebView.getParent();
                if (parent != null) parent.removeView(playerWebView);
                playerWebView.destroy();
            } catch (Exception ignored) {}
            playerWebView = null;
        }
    }
}
