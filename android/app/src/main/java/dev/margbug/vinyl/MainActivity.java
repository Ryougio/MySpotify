package dev.margbug.vinyl;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity implements MediaPlaybackService.PlaybackEventListener {

    private WebView webView;
    private WebAppInterface webAppInterface;
    private ActivityResultLauncher<Intent> loginLauncher;
    private long lastBackPressTime = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SpotifyApiClient.init(this);

        // Register login launcher
        loginLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == RESULT_OK) {
                        if (webView != null) {
                            webView.evaluateJavascript("if (window.onNativeLoginSuccess) window.onNativeLoginSuccess(true);", null);
                        }
                    }
                }
        );

        // Configure full dark theme immersive status bar & navigation bar
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#121212"));
        window.setNavigationBarColor(Color.parseColor("#121212"));

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString().replace("; wv", "") + " MySpotifyDesktopAndroid/0.4.34");

        webAppInterface = new WebAppInterface(this, webView);
        webView.addJavascriptInterface(webAppInterface, "AndroidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return super.onConsoleMessage(consoleMessage);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
            }
        });

        webView.setBackgroundColor(Color.parseColor("#121212"));
        webView.loadUrl("file:///android_asset/web/index.html");

        // Modern Android back-navigation handling (supports Android 13/14/15 predictive back & gestures)
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView == null) {
                    moveTaskToBack(true);
                    return;
                }
                webView.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false", value -> {
                    if (!"true".equals(value)) {
                        long now = System.currentTimeMillis();
                        if (now - lastBackPressTime < 2000) {
                            moveTaskToBack(true);
                        } else {
                            lastBackPressTime = now;
                            Toast.makeText(MainActivity.this, "再按一次返回桌面", Toast.LENGTH_SHORT).show();
                        }
                    }
                });
            }
        });

        MediaPlaybackService.setEventListener(this);
    }

    public void launchSpotifyLogin() {
        Intent intent = new Intent(this, SpotifyLoginActivity.class);
        loginLauncher.launch(intent);
    }

    @Override
    public void onPlaybackStateChanged(boolean isPlaying, int currentPositionMs, int durationMs) {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        String.format("if (window.onNativePlaybackStateChanged) window.onNativePlaybackStateChanged(%b, %d, %d);",
                                isPlaying, currentPositionMs, durationMs),
                        null
                );
            }
        });
    }

    @Override
    public void onTrackEnded() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if (window.onNativeTrackEnded) window.onNativeTrackEnded();", null);
            }
        });
    }

    @Override
    public void onNextRequested() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if (window.onNativeNextRequested) window.onNativeNextRequested();", null);
            }
        });
    }

    @Override
    public void onPrevRequested() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if (window.onNativePrevRequested) window.onNativePrevRequested();", null);
            }
        });
    }

    @Override
    protected void onDestroy() {
        MediaPlaybackService.setEventListener(null);
        if (webAppInterface != null) {
            webAppInterface.cleanup();
        }
        super.onDestroy();
    }
}
