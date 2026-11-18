package dev.margbug.vinyl;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.PlaybackParams;
import android.media.audiofx.Equalizer;
import android.net.wifi.WifiManager;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MediaPlaybackService extends Service implements
        MediaPlayer.OnPreparedListener,
        MediaPlayer.OnCompletionListener,
        MediaPlayer.OnErrorListener,
        AudioManager.OnAudioFocusChangeListener {

    private static final String TAG = "MediaPlaybackService";

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
    public static final String ACTION_SYNC_WEB_STATE = "dev.margbug.vinyl.SYNC_WEB_STATE";

    private static final String CHANNEL_ID = "vinyl_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    public interface PlaybackEventListener {
        void onPlaybackStateChanged(boolean isPlaying, int currentPositionMs, int durationMs);
        void onTrackEnded();
        void onNextRequested();
        void onPrevRequested();
        void onRemoteTogglePlayPause(boolean wantPlay);
        void onRemoteSeekTo(int positionMs);
        void onPlaybackError(String errorMsg);
    }

    private static PlaybackEventListener eventListener;
    public static void setEventListener(PlaybackEventListener listener) {
        eventListener = listener;
    }

    private MediaPlayer mediaPlayer;
    private Equalizer equalizer;
    private boolean eqEnabled = false;
    private float[] eqGains = new float[]{0f, 0f, 0f, 0f, 0f, 0f};
    private float playbackSpeed = 1.0f;
    private static final int[] EQ_BANDS_HZ = new int[]{60, 150, 400, 1000, 2400, 15000};
    private MediaSessionCompat mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private String currentTitle = "MySpotify";
    private String currentArtist = "Spotify on Android";
    private String currentAlbum = "";
    private String currentCoverUrl = "";
    private String loadedCoverUrl = "";
    private Bitmap currentCoverBitmap = null;
    private boolean isPlaying = false;
    private boolean mediaPlayerPrepared = false;
    private boolean webEngineActive = false;
    private int webPositionMs = 0;
    private int webDurationMs = 0;

    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService coverExecutor = Executors.newSingleThreadExecutor();

    private final BroadcastReceiver noisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                if (webEngineActive) {
                    if (eventListener != null) eventListener.onRemoteTogglePlayPause(false);
                } else {
                    pause();
                }
            }
        }
    };

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (!webEngineActive && mediaPlayer != null && isPlaying) {
                try {
                    int pos = mediaPlayer.getCurrentPosition();
                    int dur = mediaPlayer.getDuration();
                    if (eventListener != null) {
                        eventListener.onPlaybackStateChanged(true, pos, dur);
                    }
                    updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, pos);
                } catch (Exception ignored) {}
                progressHandler.postDelayed(this, 500);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        initMediaSession();

        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MySpotify:PlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MySpotify:PlaybackWifiLock");
            wifiLock.setReferenceCounted(false);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(noisyReceiver, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(noisyReceiver, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        }
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

    private void initMediaPlayer() {
        if (mediaPlayer == null) {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build());
            mediaPlayer.setOnPreparedListener(this);
            mediaPlayer.setOnCompletionListener(this);
            mediaPlayer.setOnErrorListener(this);
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "MySpotifyMediaSession");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                if (webEngineActive) {
                    if (eventListener != null) eventListener.onRemoteTogglePlayPause(true);
                } else {
                    resume();
                }
            }

            @Override
            public void onPause() {
                if (webEngineActive) {
                    if (eventListener != null) eventListener.onRemoteTogglePlayPause(false);
                } else {
                    pause();
                }
            }

            @Override
            public void onSkipToNext() {
                if (eventListener != null) eventListener.onNextRequested();
            }

            @Override
            public void onSkipToPrevious() {
                if (eventListener != null) eventListener.onPrevRequested();
            }

            @Override
            public void onSeekTo(long pos) {
                if (webEngineActive) {
                    if (eventListener != null) eventListener.onRemoteSeekTo((int) pos);
                } else {
                    seekTo((int) pos);
                }
            }

            @Override
            public void onStop() {
                stopPlayback();
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // CRITICAL for Android 12/14/15: promote to foreground immediately before any async work!
        try {
            updateNotification();
        } catch (Exception e) {
            Log.e(TAG, "Immediate startForeground failed: " + e.getMessage());
        }

        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_SYNC_WEB_STATE.equals(action)) {
            webEngineActive = true;
            stopNativeMediaPlayerQuietly();
            String t = intent.getStringExtra("title");
            String a = intent.getStringExtra("artist");
            String al = intent.getStringExtra("album");
            String c = intent.getStringExtra("coverUrl");
            if (t != null && !t.isEmpty()) currentTitle = t;
            if (a != null) currentArtist = a;
            if (al != null) currentAlbum = al;
            if (c != null) currentCoverUrl = c;
            isPlaying = intent.getBooleanExtra("isPlaying", isPlaying);
            webPositionMs = intent.getIntExtra("positionMs", webPositionMs);
            webDurationMs = intent.getIntExtra("durationMs", webDurationMs);

            if (isPlaying) {
                requestAudioFocus();
                acquireLocks();
            } else {
                releaseLocks();
            }
            if (currentCoverUrl != null && !currentCoverUrl.isEmpty() && !currentCoverUrl.equals(loadedCoverUrl)) {
                fetchCoverBitmap(currentCoverUrl);
            }
            updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, webPositionMs);
            updateMediaMetadata();
            updateNotification();
        } else if (ACTION_PLAY.equals(action)) {
            webEngineActive = false;
            String url = intent.getStringExtra("url");
            currentTitle = intent.getStringExtra("title");
            currentArtist = intent.getStringExtra("artist");
            currentAlbum = intent.getStringExtra("album");
            currentCoverUrl = intent.getStringExtra("coverUrl");
            playUrl(url);
        } else if (ACTION_PAUSE.equals(action)) {
            if (webEngineActive) {
                if (eventListener != null) eventListener.onRemoteTogglePlayPause(false);
            } else {
                pause();
            }
        } else if (ACTION_RESUME.equals(action)) {
            if (webEngineActive) {
                if (eventListener != null) eventListener.onRemoteTogglePlayPause(true);
            } else {
                resume();
            }
        } else if (ACTION_TOGGLE.equals(action)) {
            if (webEngineActive) {
                if (eventListener != null) eventListener.onRemoteTogglePlayPause(!isPlaying);
            } else {
                if (isPlaying) pause(); else resume();
            }
        } else if (ACTION_NEXT.equals(action)) {
            if (eventListener != null) eventListener.onNextRequested();
        } else if (ACTION_PREV.equals(action)) {
            if (eventListener != null) eventListener.onPrevRequested();
        } else if (ACTION_SEEK.equals(action)) {
            int positionMs = intent.getIntExtra("positionMs", 0);
            if (webEngineActive) {
                if (eventListener != null) eventListener.onRemoteSeekTo(positionMs);
            } else {
                seekTo(positionMs);
            }
        } else if (ACTION_SET_EQ.equals(action)) {
            eqEnabled = intent.getBooleanExtra("enabled", false);
            float[] gains = intent.getFloatArrayExtra("gains");
            if (gains != null && gains.length == 6) {
                eqGains = gains;
            }
            applyEqualizer();
        } else if (ACTION_SET_SPEED.equals(action)) {
            float speed = intent.getFloatExtra("speed", 1.0f);
            playbackSpeed = Math.max(0.5f, Math.min(3.0f, speed));
            applyPlaybackSpeed();
        } else if (ACTION_STOP.equals(action)) {
            stopPlayback();
        }

        return START_NOT_STICKY;
    }

    private void stopNativeMediaPlayerQuietly() {
        progressHandler.removeCallbacks(progressRunnable);
        mediaPlayerPrepared = false;
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.reset();
            } catch (Exception ignored) {}
        }
    }

    public void playUrl(String url) {
        if (url == null || url.isEmpty()) return;
        Log.i(TAG, "Native MediaPlayer playUrl: " + url);
        requestAudioFocus();
        try {
            initMediaPlayer();
            mediaPlayerPrepared = false;
            mediaPlayer.reset();
            mediaPlayer.setDataSource(url);
            mediaPlayer.prepareAsync();
            updateMediaMetadata();
            updateNotification();
            fetchCoverBitmap(currentCoverUrl);
            acquireLocks();
        } catch (Exception e) {
            Log.e(TAG, "playUrl exception: " + e.getMessage(), e);
            if (eventListener != null) {
                eventListener.onPlaybackError("播放器初始化失败: " + e.getMessage());
            }
        }
    }

    public void pause() {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            isPlaying = false;
            progressHandler.removeCallbacks(progressRunnable);
            updatePlaybackState(PlaybackStateCompat.STATE_PAUSED, mediaPlayer.getCurrentPosition());
            updateNotification();
            releaseLocks();
            if (eventListener != null) {
                eventListener.onPlaybackStateChanged(false, mediaPlayer.getCurrentPosition(), mediaPlayer.getDuration());
            }
        }
    }

    public void resume() {
        if (mediaPlayer != null && !mediaPlayer.isPlaying()) {
            requestAudioFocus();
            mediaPlayer.start();
            isPlaying = true;
            acquireLocks();
            progressHandler.post(progressRunnable);
            updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, mediaPlayer.getCurrentPosition());
            updateNotification();
            if (eventListener != null) {
                eventListener.onPlaybackStateChanged(true, mediaPlayer.getCurrentPosition(), mediaPlayer.getDuration());
            }
        }
    }

    public void seekTo(int posMs) {
        if (mediaPlayer != null) {
            mediaPlayer.seekTo(posMs);
            updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, posMs);
            if (eventListener != null) {
                eventListener.onPlaybackStateChanged(isPlaying, posMs, mediaPlayer.getDuration());
            }
        }
    }

    private void applyEqualizer() {
        try {
            if (mediaPlayer == null) return;
            int sessionId = mediaPlayer.getAudioSessionId();
            if (sessionId <= 0) return;
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
            Log.w(TAG, "applyEqualizer failed: " + e.getMessage());
        }
    }

    private void applyPlaybackSpeed() {
        try {
            if (mediaPlayer != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PlaybackParams params = mediaPlayer.getPlaybackParams();
                if (params == null) params = new PlaybackParams();
                params.setSpeed(playbackSpeed);
                mediaPlayer.setPlaybackParams(params);
            }
        } catch (Exception e) {
            Log.w(TAG, "applyPlaybackSpeed failed: " + e.getMessage());
        }
    }

    public void stopPlayback() {
        progressHandler.removeCallbacks(progressRunnable);
        if (equalizer != null) {
            try { equalizer.release(); } catch (Exception ignored) {}
            equalizer = null;
        }
        if (mediaPlayer != null) {
            try {
                mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
        isPlaying = false;
        webEngineActive = false;
        releaseLocks();
        abandonAudioFocus();
        if (mediaSession != null) {
            mediaSession.setActive(false);
        }
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onPrepared(MediaPlayer mp) {
        mediaPlayerPrepared = true;
        Log.i(TAG, "MediaPlayer prepared, duration=" + mp.getDuration() + "ms");
        applyEqualizer();
        mp.start();
        if (playbackSpeed != 1.0f) {
            applyPlaybackSpeed();
        }
        isPlaying = true;
        progressHandler.post(progressRunnable);
        updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, 0);
        updateMediaMetadata();
        updateNotification();
        if (eventListener != null) {
            eventListener.onPlaybackStateChanged(true, 0, mp.getDuration());
        }
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        isPlaying = false;
        progressHandler.removeCallbacks(progressRunnable);
        updatePlaybackState(PlaybackStateCompat.STATE_STOPPED, 0);
        updateNotification();
        if (eventListener != null) {
            eventListener.onTrackEnded();
        }
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        Log.e(TAG, "MediaPlayer onError: what=" + what + " extra=" + extra);
        isPlaying = false;
        mediaPlayerPrepared = false;
        progressHandler.removeCallbacks(progressRunnable);
        releaseLocks();
        if (eventListener != null) {
            eventListener.onPlaybackError("音频播放失败 (what=" + what + ", extra=" + extra + ")");
        }
        return true;
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
        long dur = webEngineActive ? webDurationMs : (mediaPlayer != null && mediaPlayerPrepared ? mediaPlayer.getDuration() : 0);
        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle != null ? currentTitle : "MySpotify")
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist != null ? currentArtist : "")
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum != null ? currentAlbum : "")
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, Math.max(0, dur));
        if (currentCoverBitmap != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentCoverBitmap);
        }
        mediaSession.setMetadata(builder.build());
    }

    private void fetchCoverBitmap(String urlStr) {
        if (urlStr == null || urlStr.isEmpty() || urlStr.startsWith("data:")) return;
        loadedCoverUrl = urlStr;
        coverExecutor.execute(() -> {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                try (InputStream is = conn.getInputStream()) {
                    Bitmap bmp = BitmapFactory.decodeStream(is);
                    if (bmp != null) {
                        currentCoverBitmap = bmp;
                        new Handler(Looper.getMainLooper()).post(() -> {
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
                .setContentTitle(currentTitle != null ? currentTitle : "MySpotify")
                .setContentText(currentArtist != null ? currentArtist : "")
                .setSubText(currentAlbum != null ? currentAlbum : "")
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

    private void requestAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build())
                    .setOnAudioFocusChangeListener(this)
                    .build();
            audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            audioManager.requestAudioFocus(this, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(this);
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        if (focusChange == AudioManager.AUDIOFOCUS_LOSS || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            if (webEngineActive) {
                if (eventListener != null) eventListener.onRemoteTogglePlayPause(false);
            } else {
                pause();
            }
        } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
            if (webEngineActive) {
                if (eventListener != null) eventListener.onRemoteTogglePlayPause(true);
            } else {
                resume();
            }
        }
    }

    private void acquireLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire(60 * 60 * 1000L);
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } catch (Exception ignored) {}
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(noisyReceiver);
        } catch (Exception ignored) {}
        stopPlayback();
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
