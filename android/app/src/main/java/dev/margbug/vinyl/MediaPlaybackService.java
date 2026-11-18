package dev.margbug.vinyl;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.audiofx.Equalizer;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.analytics.AnalyticsListener;
import androidx.media3.exoplayer.drm.DefaultDrmSessionManager;
import androidx.media3.exoplayer.drm.DummyExoMediaDrm;
import androidx.media3.exoplayer.drm.FrameworkMediaDrm;
import androidx.media3.exoplayer.drm.HttpMediaDrmCallback;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Native AndroidX Media3 ExoPlayer + Widevine DRM Foreground Service.
 * Plays official Spotify Widevine encrypted HLS streams natively in the background,
 * supporting glitch-free seeking, screen-off playback, lockscreen controls,
 * hardware 6-band Equalizer, playback speed, and automatic 256k->128k Free-account downgrade.
 */
public class MediaPlaybackService extends Service implements Player.Listener, LocalMediaServer.EventListener {

    private static final String TAG = "MediaPlaybackService";

    public static final String ACTION_PLAY_SPOTIFY = "dev.margbug.vinyl.PLAY_SPOTIFY";
    public static final String ACTION_PLAY = "dev.margbug.vinyl.PLAY";
    public static final String ACTION_PAUSE = "dev.margbug.vinyl.PAUSE";
    public static final String ACTION_RESUME = "dev.margbug.vinyl.RESUME";
    public static final String ACTION_TOGGLE = "dev.margbug.vinyl.TOGGLE";
    public static final String ACTION_NEXT = "dev.margbug.vinyl.NEXT";
    public static final String ACTION_PREV = "dev.margbug.vinyl.PREV";
    public static final String ACTION_STOP = "dev.margbug.vinyl.STOP";
    public static final String ACTION_SEEK = "dev.margbug.vinyl.SEEK";
    public static final String ACTION_SET_EQ = "dev.margbug.vinyl.SET_EQ";
    public static final String ACTION_SET_SPEED = "dev.margbug.vinyl.SET_SPEED";
    public static final String ACTION_SET_CROSSFADE = "dev.margbug.vinyl.SET_CROSSFADE";

    private static final String CHANNEL_ID = "vinyl_playback_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final String KEY_ACCOUNT_FREE_ONLY = "spotify_account_free_only";
    private static final int[] EQ_BANDS_HZ = new int[]{60, 150, 400, 1000, 2400, 15000};

    public interface PlaybackEventListener {
        void onPlaybackStateChanged(boolean isPlaying, int currentPositionMs, int durationMs);
        void onTrackEnded();
        void onNextRequested();
        void onPrevRequested();
        void onQualityChanged(String badgeText);
        void onPlaybackError(String errorMsg);
    }

    private static volatile PlaybackEventListener eventListener;
    public static void setEventListener(PlaybackEventListener listener) {
        eventListener = listener;
    }

    private ExoPlayer exoPlayer;
    private LocalMediaServer localServer;
    private Equalizer equalizer;
    private boolean eqEnabled = false;
    private float[] eqGains = new float[]{0f, 0f, 0f, 0f, 0f, 0f};
    private float playbackSpeed = 1.0f;
    private MediaSessionCompat mediaSession;

    private String currentUri = "";
    private String currentTitle = "MySpotify";
    private String currentArtist = "Spotify on Android";
    private String currentAlbum = "";
    private String currentCoverUrl = "";
    private String loadedCoverUrl = "";
    private Bitmap currentCoverBitmap = null;
    private long currentDurationMs = 0;

    private volatile boolean isPlaying = false;
    private volatile boolean accountFreeOnly = false;
    private volatile int activeGen = 0;
    private volatile int activeBitrate = 0;
    private volatile boolean downgradingNow = false;
    private final Set<String> downgradedUris = ConcurrentHashMap.newKeySet();
    private final AtomicInteger playRequestSeq = new AtomicInteger(0);

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService bgExecutor = Executors.newCachedThreadPool();

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (exoPlayer != null && isPlaying) {
                try {
                    long pos = Math.max(0, exoPlayer.getCurrentPosition());
                    long dur = exoPlayer.getDuration();
                    if (dur == C.TIME_UNSET || dur <= 0) dur = currentDurationMs;
                    else currentDurationMs = dur;

                    if (eventListener != null) {
                        eventListener.onPlaybackStateChanged(true, (int) pos, (int) dur);
                    }
                    updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, pos);
                } catch (Exception ignored) {}
                mainHandler.postDelayed(this, 500);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        SpotifyApiClient.init(this);
        SharedPreferences prefs = getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        accountFreeOnly = prefs.getBoolean(KEY_ACCOUNT_FREE_ONLY, false);
        eqEnabled = prefs.getBoolean("eq_enabled", false);
        parseEqGains(prefs.getString("eq_gains", "[0,0,0,0,0,0]"));

        createNotificationChannel();
        initLocalServer();
        initExoPlayer();
        initMediaSession();
    }

    private void initLocalServer() {
        localServer = new LocalMediaServer(this, this);
        try {
            localServer.start();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start LocalMediaServer: " + e.getMessage(), e);
        }
    }

    private void initExoPlayer() {
        if (exoPlayer != null) return;
        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
                .setEnableDecoderFallback(true);
        exoPlayer = new ExoPlayer.Builder(this, renderersFactory).build();
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();
        // ExoPlayer handles AudioFocus, noisy headphone disconnect, and WakeLock/WifiLock natively!
        exoPlayer.setAudioAttributes(attrs, true);
        exoPlayer.setHandleAudioBecomingNoisy(true);
        exoPlayer.setWakeMode(C.WAKE_MODE_NETWORK);
        exoPlayer.addListener(this);
        exoPlayer.addAnalyticsListener(new AnalyticsListener() {
            @Override
            public void onDrmSessionAcquired(EventTime eventTime, int state) {
                Log.i(TAG, "Analytics onDrmSessionAcquired state=" + state);
            }
            @Override
            public void onDrmKeysLoaded(EventTime eventTime) {
                Log.i(TAG, "Analytics onDrmKeysLoaded!");
            }
            @Override
            public void onDrmSessionManagerError(EventTime eventTime, Exception error) {
                Log.e(TAG, "Analytics onDrmSessionManagerError: " + error.getMessage(), error);
            }
            @Override
            public void onAudioDecoderInitialized(EventTime eventTime, String decoderName, long initializedTimestampMs, long initializationDurationMs) {
                Log.i(TAG, "Analytics onAudioDecoderInitialized: " + decoderName);
            }
            @Override
            public void onAudioCodecError(EventTime eventTime, Exception audioCodecError) {
                Log.e(TAG, "Analytics onAudioCodecError: " + audioCodecError.getMessage(), audioCodecError);
            }
            @Override
            public void onAudioSinkError(EventTime eventTime, Exception audioSinkError) {
                Log.e(TAG, "Analytics onAudioSinkError: " + audioSinkError.getMessage(), audioSinkError);
            }
        });
        Log.i(TAG, "Media3 ExoPlayer initialized (audioSessionId=" + exoPlayer.getAudioSessionId() + ")");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "MySpotify 播放控制器",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("显示当前播放曲目、封面与控制卡片");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "MySpotifyMediaSession");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() { resume(); }
            @Override
            public void onPause() { pause(); }
            @Override
            public void onSkipToNext() {
                if (eventListener != null) eventListener.onNextRequested();
            }
            @Override
            public void onSkipToPrevious() {
                if (eventListener != null) eventListener.onPrevRequested();
            }
            @Override
            public void onSeekTo(long pos) { seekTo((int) pos); }
            @Override
            public void onStop() { stopPlayback(); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Android 12/14/15 requirement: promote to foreground immediately in onStartCommand
        try {
            updateNotification();
        } catch (Exception e) {
            Log.e(TAG, "Immediate startForeground failed: " + e.getMessage());
        }

        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_PLAY_SPOTIFY.equals(action)) {
            String uri = intent.getStringExtra("uri");
            String title = intent.getStringExtra("title");
            String artist = intent.getStringExtra("artist");
            String album = intent.getStringExtra("album");
            String coverUrl = intent.getStringExtra("coverUrl");
            long durMs = intent.getLongExtra("durationMs", 0);
            playSpotifyTrack(uri, title, artist, album, coverUrl, durMs);
        } else if (ACTION_PLAY.equals(action)) {
            String url = intent.getStringExtra("url");
            currentUri = "";
            currentTitle = safeStr(intent.getStringExtra("title"), "MySpotify");
            currentArtist = safeStr(intent.getStringExtra("artist"), "");
            currentAlbum = safeStr(intent.getStringExtra("album"), "");
            currentCoverUrl = safeStr(intent.getStringExtra("coverUrl"), "");
            playDirectUrl(url);
        } else if (ACTION_PAUSE.equals(action)) {
            pause();
        } else if (ACTION_RESUME.equals(action)) {
            resume();
        } else if (ACTION_TOGGLE.equals(action)) {
            if (isPlaying) pause(); else resume();
        } else if (ACTION_NEXT.equals(action)) {
            if (eventListener != null) eventListener.onNextRequested();
        } else if (ACTION_PREV.equals(action)) {
            if (eventListener != null) eventListener.onPrevRequested();
        } else if (ACTION_SEEK.equals(action)) {
            seekTo(intent.getIntExtra("positionMs", 0));
        } else if (ACTION_SET_EQ.equals(action)) {
            eqEnabled = intent.getBooleanExtra("enabled", false);
            float[] gains = intent.getFloatArrayExtra("gains");
            if (gains != null && gains.length == 6) {
                eqGains = gains;
            }
            applyEqualizer();
        } else if (ACTION_SET_SPEED.equals(action)) {
            float speed = intent.getFloatExtra("speed", 1.0f);
            playbackSpeed = Math.max(0.5f, Math.min(2.5f, speed));
            applyPlaybackSpeed();
        } else if (ACTION_STOP.equals(action)) {
            stopPlayback();
        }

        return START_NOT_STICKY;
    }

    private boolean isLoggedIn() {
        SharedPreferences prefs = getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        String spDc = prefs.getString(SpotifyLoginActivity.KEY_SP_DC, null);
        return spDc != null && !spDc.trim().isEmpty();
    }

    private void playSpotifyTrack(String uri, String title, String artist, String album, String coverUrl, long durationMs) {
        final int reqId = playRequestSeq.incrementAndGet();
        downgradingNow = false;
        activeGen = 0;

        currentUri = safeStr(uri, "");
        currentTitle = safeStr(title, "MySpotify");
        currentArtist = safeStr(artist, "");
        currentAlbum = safeStr(album, "");
        currentCoverUrl = safeStr(coverUrl, "");
        currentDurationMs = Math.max(0, durationMs);

        updateMediaMetadata();
        updateNotification();
        if (!currentCoverUrl.isEmpty() && !currentCoverUrl.equals(loadedCoverUrl)) {
            fetchCoverBitmap(currentCoverUrl);
        }

        // Refresh free-account flag in case user logged out / switched accounts
        SharedPreferences prefs = getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        accountFreeOnly = prefs.getBoolean(KEY_ACCOUNT_FREE_ONLY, false);

        boolean validSpotifyUri = currentUri.startsWith("spotify:track:") || currentUri.startsWith("spotify:episode:");
        if (isLoggedIn() && validSpotifyUri && localServer != null && localServer.getPort() > 0) {
            boolean forceLowest = accountFreeOnly || downgradedUris.contains(currentUri);
            Log.i(TAG, "Resolving Spotify HLS for ExoPlayer: uri=" + currentUri + " forceLowest=" + forceLowest);
            SpotifyApiClient.resolveSpotifyMedia(this, currentUri, !forceLowest, forceLowest, new SpotifyApiClient.MediaCallback() {
                @Override
                public void onSuccess(SpotifyApiClient.SpotifyMedia media) {
                    if (reqId != playRequestSeq.get()) return;
                    if (media.durationMs > 0) currentDurationMs = media.durationMs;
                    activeBitrate = media.bitrate;

                    if (media.fileUrl != null && !media.fileUrl.isEmpty()) {
                        notifyQuality("播客原音");
                        playDirectUrl(media.fileUrl);
                        return;
                    }

                    // Fetch Widevine privacy serviceCertificate (cached after first call) on bg thread
                    bgExecutor.execute(() -> {
                        byte[] cert = SpotifyApiClient.fetchWidevineCertSync(MediaPlaybackService.this);
                        if (reqId != playRequestSeq.get()) return;
                        LocalMediaServer.TrackSession session = localServer.registerHlsTrack(media);
                        activeGen = session.gen;
                        String badge = media.bitrate >= 200000 ? "256k" : (media.bitrate > 0 ? (media.bitrate / 1000) + "k" : "AAC");
                        mainHandler.post(() -> {
                            if (reqId != playRequestSeq.get()) return;
                            notifyQuality(badge);
                            startExoWidevineHls(session, cert);
                        });
                    });
                }

                @Override
                public void onError(Exception error) {
                    if (reqId != playRequestSeq.get()) return;
                    String msg = error.getMessage() != null ? error.getMessage() : "网络异常";
                    Log.e(TAG, "resolveSpotifyMedia failed: " + msg);
                    notifyError(msg.contains("connection closed")
                            ? "Spotify 音源连接被代理重置，请检查 FlClash 节点"
                            : "获取音源失败：" + msg);
                }
            });
        } else {
            // Guest mode: iTunes HTTPS preview
            Log.i(TAG, "Guest mode, resolving preview for: " + currentTitle);
            SpotifyApiClient.resolveAudioUrl(currentTitle, currentArtist, new SpotifyApiClient.ApiCallback() {
                @Override
                public void onSuccess(String response) {
                    if (reqId != playRequestSeq.get()) return;
                    try {
                        JSONObject obj = new JSONObject(response);
                        String previewUrl = obj.optString("audioUrl", "");
                        if (previewUrl.startsWith("http")) {
                            notifyQuality("试听");
                            playDirectUrl(previewUrl);
                            return;
                        }
                    } catch (Exception ignored) {}
                    notifyError("未找到可播放试听音源，请登录 Spotify 账号播放完整曲目");
                }

                @Override
                public void onError(Exception error) {
                    if (reqId != playRequestSeq.get()) return;
                    notifyError("试听加载失败，请登录 Spotify 账号播放完整曲目");
                }
            });
        }
    }

    private void startExoWidevineHls(LocalMediaServer.TrackSession session, byte[] widevineCert) {
        try {
            initExoPlayer();
            String base = "http://127.0.0.1:" + localServer.getPort();
            String manifestUrl = base + "/m/" + session.gen + "/track.m3u8";
            String licenseUrl = base + "/license?gen=" + session.gen;

            DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
                    .setConnectTimeoutMs(15_000)
                    .setReadTimeoutMs(20_000)
                    .setAllowCrossProtocolRedirects(true);

            HttpMediaDrmCallback drmCallback = new HttpMediaDrmCallback(licenseUrl, httpFactory);

            DefaultDrmSessionManager drmSessionManager = new DefaultDrmSessionManager.Builder()
                    .setUuidAndExoMediaDrmProvider(C.WIDEVINE_UUID, uuid -> {
                        try {
                            FrameworkMediaDrm drm = FrameworkMediaDrm.newInstance(uuid);
                            String secLevel = "";
                            try {
                                secLevel = drm.getPropertyString("securityLevel");
                            } catch (Exception ignored) {}
                            Log.i(TAG, "FrameworkMediaDrm native securityLevel=" + secLevel);
                            if (widevineCert != null && widevineCert.length > 0) {
                                try {
                                    drm.setPropertyString("privacyMode", "enable");
                                    drm.setPropertyByteArray("serviceCertificate", widevineCert);
                                    Log.i(TAG, "Widevine serviceCertificate applied (" + widevineCert.length + "B)");
                                } catch (Exception e) {
                                    Log.w(TAG, "serviceCertificate note: " + e.getMessage());
                                }
                            }
                            return drm;
                        } catch (Exception e) {
                            Log.e(TAG, "FrameworkMediaDrm init failed: " + e.getMessage(), e);
                            return new DummyExoMediaDrm();
                        }
                    })
                    .setPlayClearSamplesWithoutKeys(false)
                    .build(drmCallback);

            MediaItem mediaItem = new MediaItem.Builder()
                    .setUri(manifestUrl)
                    .setMimeType(MimeTypes.APPLICATION_M3U8)
                    .build();

            HlsMediaSource hlsSource = new HlsMediaSource.Factory(httpFactory)
                    .setDrmSessionManagerProvider(item -> drmSessionManager)
                    .createMediaSource(mediaItem);

            Log.i(TAG, "ExoPlayer preparing Widevine HLS: gen=" + session.gen + " url=" + manifestUrl);
            exoPlayer.stop();
            exoPlayer.clearMediaItems();
            exoPlayer.setMediaSource(hlsSource);
            exoPlayer.prepare();
            exoPlayer.setPlayWhenReady(true);
            applyPlaybackSpeed();
        } catch (Exception e) {
            Log.e(TAG, "startExoWidevineHls exception: " + e.getMessage(), e);
            notifyError("Widevine 播放初始化失败：" + e.getMessage());
        }
    }

    public void playDirectUrl(String url) {
        if (url == null || url.isEmpty()) return;
        mainHandler.post(() -> {
            try {
                initExoPlayer();
                Log.i(TAG, "ExoPlayer playing direct URL: " + url);
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
                exoPlayer.setMediaItem(MediaItem.fromUri(url));
                exoPlayer.prepare();
                exoPlayer.setPlayWhenReady(true);
                applyPlaybackSpeed();
                updateMediaMetadata();
                updateNotification();
                if (!currentCoverUrl.isEmpty() && !currentCoverUrl.equals(loadedCoverUrl)) {
                    fetchCoverBitmap(currentCoverUrl);
                }
            } catch (Exception e) {
                Log.e(TAG, "playDirectUrl exception: " + e.getMessage(), e);
                notifyError("音频加载失败：" + e.getMessage());
            }
        });
    }

    public void pause() {
        if (exoPlayer != null) {
            exoPlayer.pause();
        }
    }

    public void resume() {
        if (exoPlayer != null) {
            exoPlayer.play();
        }
    }

    public void seekTo(int posMs) {
        if (exoPlayer != null) {
            long target = Math.max(0, posMs);
            Log.i(TAG, "ExoPlayer seekTo: " + target + "ms");
            exoPlayer.seekTo(target);
            long dur = exoPlayer.getDuration();
            if (dur == C.TIME_UNSET || dur <= 0) dur = currentDurationMs;
            updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, target);
            if (eventListener != null) {
                eventListener.onPlaybackStateChanged(isPlaying, (int) target, (int) dur);
            }
        }
    }

    private void applyEqualizer() {
        try {
            if (exoPlayer == null) return;
            int sessionId = exoPlayer.getAudioSessionId();
            if (sessionId == C.AUDIO_SESSION_ID_UNSET || sessionId <= 0) return;
            if (equalizer == null) {
                equalizer = new Equalizer(0, sessionId);
            }
            equalizer.setEnabled(eqEnabled);
            if (!eqEnabled) return;

            short numBands = equalizer.getNumberOfBands();
            short[] range = equalizer.getBandLevelRange();
            short minLevel = range[0];
            short maxLevel = range[1];
            for (short b = 0; b < numBands; b++) {
                int centerHz = equalizer.getCenterFreq(b) / 1000;
                int nearestIdx = 0;
                double bestDiff = Double.MAX_VALUE;
                for (int i = 0; i < EQ_BANDS_HZ.length; i++) {
                    double diff = Math.abs(Math.log((double) Math.max(1, centerHz)) - Math.log((double) EQ_BANDS_HZ[i]));
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        nearestIdx = i;
                    }
                }
                short targetMb = (short) Math.round(eqGains[nearestIdx] * 100.0f);
                if (targetMb < minLevel) targetMb = minLevel;
                if (targetMb > maxLevel) targetMb = maxLevel;
                equalizer.setBandLevel(b, targetMb);
            }
        } catch (Exception e) {
            Log.w(TAG, "applyEqualizer skipped: " + e.getMessage());
        }
    }

    private void applyPlaybackSpeed() {
        try {
            if (exoPlayer != null) {
                exoPlayer.setPlaybackParameters(new PlaybackParameters(playbackSpeed));
            }
        } catch (Exception e) {
            Log.w(TAG, "applyPlaybackSpeed failed: " + e.getMessage());
        }
    }

    public void stopPlayback() {
        mainHandler.removeCallbacks(progressRunnable);
        if (equalizer != null) {
            try { equalizer.release(); } catch (Exception ignored) {}
            equalizer = null;
        }
        if (exoPlayer != null) {
            try {
                exoPlayer.stop();
                exoPlayer.release();
            } catch (Exception ignored) {}
            exoPlayer = null;
        }
        isPlaying = false;
        if (mediaSession != null) {
            mediaSession.setActive(false);
        }
        stopForeground(true);
        stopSelf();
    }

    // ==================== ExoPlayer Player.Listener ====================

    @Override
    public void onIsPlayingChanged(boolean playing) {
        isPlaying = playing;
        long pos = exoPlayer != null ? Math.max(0, exoPlayer.getCurrentPosition()) : 0;
        long dur = (exoPlayer != null && exoPlayer.getDuration() != C.TIME_UNSET && exoPlayer.getDuration() > 0)
                ? exoPlayer.getDuration() : currentDurationMs;
        if (dur > 0) currentDurationMs = dur;

        Log.i(TAG, "ExoPlayer onIsPlayingChanged: playing=" + playing + " pos=" + pos + "ms dur=" + dur + "ms");
        mainHandler.removeCallbacks(progressRunnable);
        if (playing) {
            mainHandler.post(progressRunnable);
        }
        updatePlaybackState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, pos);
        updateMediaMetadata();
        updateNotification();
        if (eventListener != null) {
            eventListener.onPlaybackStateChanged(playing, (int) pos, (int) dur);
        }
    }

    @Override
    public void onPlaybackStateChanged(int playbackState) {
        if (playbackState == Player.STATE_READY && exoPlayer != null) {
            long dur = exoPlayer.getDuration();
            if (dur != C.TIME_UNSET && dur > 0) currentDurationMs = dur;
            Log.i(TAG, "ExoPlayer STATE_READY! duration=" + currentDurationMs + "ms audioSessionId=" + exoPlayer.getAudioSessionId());
            applyEqualizer();
            applyPlaybackSpeed();
            updateMediaMetadata();
            updateNotification();
        } else if (playbackState == Player.STATE_ENDED) {
            Log.i(TAG, "ExoPlayer STATE_ENDED");
            isPlaying = false;
            mainHandler.removeCallbacks(progressRunnable);
            updatePlaybackState(PlaybackStateCompat.STATE_STOPPED, 0);
            updateNotification();
            if (eventListener != null) {
                eventListener.onTrackEnded();
            }
        }
    }

    @Override
    public void onPlayerError(PlaybackException error) {
        if (downgradingNow) {
            Log.i(TAG, "Ignoring expected 403 DRM error during automatic 256k->128k Free downgrade");
            return;
        }
        String errDetail = error.getErrorCodeName() + (error.getMessage() != null ? (": " + error.getMessage()) : "");
        Log.e(TAG, "ExoPlayer onPlayerError: " + errDetail, error);
        isPlaying = false;
        mainHandler.removeCallbacks(progressRunnable);
        updatePlaybackState(PlaybackStateCompat.STATE_ERROR, 0);
        updateNotification();
        notifyError("播放异常：" + errDetail);
    }

    // ==================== LocalMediaServer.EventListener ====================

    @Override
    public void onPlayerEvent(int gen, String type, double timeSec, String msg, int seq) {
        // Unused in native ExoPlayer mode
    }

    @Override
    public void onLicenseResponse(int gen, int httpCode) {
        if (gen == activeGen && httpCode == 403 && !accountFreeOnly && activeBitrate > 128000) {
            Log.i(TAG, "Widevine License 403 on 256k, persisting Free 128k mode and re-resolving " + currentUri);
            downgradingNow = true;
            accountFreeOnly = true;
            downgradedUris.add(currentUri);
            activeGen = 0;
            try {
                getSharedPreferences(SpotifyLoginActivity.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putBoolean(KEY_ACCOUNT_FREE_ONLY, true).apply();
            } catch (Exception ignored) {}

            final int reqId = playRequestSeq.get();
            mainHandler.post(() -> {
                if (reqId == playRequestSeq.get()) {
                    playSpotifyTrack(currentUri, currentTitle, currentArtist, currentAlbum, currentCoverUrl, currentDurationMs);
                }
            });
        }
    }

    // ==================== Helpers & Notification ====================

    private void notifyQuality(String badge) {
        mainHandler.post(() -> {
            if (eventListener != null) eventListener.onQualityChanged(badge);
        });
    }

    private void notifyError(String msg) {
        mainHandler.post(() -> {
            if (eventListener != null) {
                eventListener.onPlaybackStateChanged(false, 0, (int) currentDurationMs);
                eventListener.onPlaybackError(msg);
            }
        });
    }

    private void parseEqGains(String gainsJson) {
        try {
            if (gainsJson == null || gainsJson.isEmpty()) return;
            JSONArray arr = new JSONArray(gainsJson);
            for (int i = 0; i < Math.min(6, arr.length()); i++) {
                eqGains[i] = (float) arr.optDouble(i, 0.0);
            }
        } catch (Exception ignored) {}
    }

    private String safeStr(String s, String def) {
        return (s != null && !s.isEmpty()) ? s : def;
    }

    private void updatePlaybackState(int state, long position) {
        if (mediaSession == null) return;
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, position, playbackSpeed)
                .build());
    }

    private void updateMediaMetadata() {
        if (mediaSession == null) return;
        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, Math.max(0, currentDurationMs));
        if (currentCoverBitmap != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentCoverBitmap);
        }
        mediaSession.setMetadata(builder.build());
    }

    private void fetchCoverBitmap(String urlStr) {
        if (urlStr == null || urlStr.isEmpty() || urlStr.startsWith("data:")) return;
        loadedCoverUrl = urlStr;
        bgExecutor.execute(() -> {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                try (InputStream is = conn.getInputStream()) {
                    Bitmap bmp = BitmapFactory.decodeStream(is);
                    if (bmp != null) {
                        currentCoverBitmap = bmp;
                        mainHandler.post(() -> {
                            updateMediaMetadata();
                            updateNotification();
                        });
                    }
                }
                conn.disconnect();
            } catch (Exception ignored) {}
        });
    }

    private void updateNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, notificationIntent, piFlags);

        PendingIntent prevIntent = PendingIntent.getService(this, 1, new Intent(this, MediaPlaybackService.class).setAction(ACTION_PREV), piFlags);
        PendingIntent toggleIntent = PendingIntent.getService(this, 2, new Intent(this, MediaPlaybackService.class).setAction(ACTION_TOGGLE), piFlags);
        PendingIntent nextIntent = PendingIntent.getService(this, 3, new Intent(this, MediaPlaybackService.class).setAction(ACTION_NEXT), piFlags);
        PendingIntent stopIntent = PendingIntent.getService(this, 4, new Intent(this, MediaPlaybackService.class).setAction(ACTION_STOP), piFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSubText(currentAlbum)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(contentIntent)
                .setDeleteIntent(stopIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(isPlaying)
                .addAction(android.R.drawable.ic_media_previous, "上一首", prevIntent)
                .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, isPlaying ? "暂停" : "播放", toggleIntent)
                .addAction(android.R.drawable.ic_media_next, "下一首", nextIntent)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2)
                        .setShowCancelButton(true)
                        .setCancelButtonIntent(stopIntent));

        if (currentCoverBitmap != null) {
            builder.setLargeIcon(currentCoverBitmap);
        }

        Notification notification = builder.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public void onDestroy() {
        stopPlayback();
        if (localServer != null) {
            localServer.stop();
            localServer = null;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return new LocalBinder();
    }

    public class LocalBinder extends Binder {
        public MediaPlaybackService getService() {
            return MediaPlaybackService.this;
        }
    }
}
