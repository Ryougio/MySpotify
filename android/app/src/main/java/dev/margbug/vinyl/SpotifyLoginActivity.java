package dev.margbug.vinyl;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import org.json.JSONObject;

public class SpotifyLoginActivity extends AppCompatActivity {

    public static final String PREFS_NAME = "spotify_prefs";
    public static final String KEY_SP_DC = "sp_dc";
    public static final String KEY_ACCESS_TOKEN = "access_token";
    public static final String KEY_ALL_COOKIES = "all_cookies";
    public static final String LOGIN_URL = "https://accounts.spotify.com/zh-CN/login?continue=https%3A%2F%2Fopen.spotify.com%2F";

    private WebView webView;
    private ProgressBar progressBar;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean isFinished = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_spotify_login);

        getWindow().setStatusBarColor(Color.parseColor("#141416"));
        getWindow().setNavigationBarColor(Color.parseColor("#141416"));

        ImageButton btnClose = findViewById(R.id.btnLoginClose);
        TextView tvTitle = findViewById(R.id.tvLoginTitle);
        progressBar = findViewById(R.id.loginProgressBar);
        webView = findViewById(R.id.loginWebView);

        tvTitle.setText("登录 Spotify 账号");
        btnClose.setOnClickListener(v -> finish());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void onTokenReceived(String tokenJson) {
                try {
                    JSONObject j = new JSONObject(tokenJson);
                    String accessToken = j.optString("accessToken", null);
                    if (accessToken != null && !accessToken.isEmpty()) {
                        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                        prefs.edit().putString(KEY_ACCESS_TOKEN, accessToken).apply();
                        completeLogin();
                    }
                } catch (Exception ignored) {}
            }
        }, "SpotifyLoginCapture");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                checkCookies(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                checkCookies(url);

                // Inject capture script to intercept web player token
                if (url != null && url.contains("open.spotify.com")) {
                    String js = "(() => {" +
                            "  if (window.__vinyl && window.__vinyl.token) {" +
                            "    window.SpotifyLoginCapture.onTokenReceived(JSON.stringify(window.__vinyl.token));" +
                            "  }" +
                            "})();";
                    view.evaluateJavascript(js, null);

                    // If we have sp_dc and are on open.spotify.com, finish successfully
                    CookieManager cm = CookieManager.getInstance();
                    String cookies = cm.getCookie("https://open.spotify.com");
                    if (cookies != null && cookies.contains("sp_dc=")) {
                        handler.postDelayed(() -> completeLogin(), 800);
                    }
                }
            }
        });

        webView.loadUrl(LOGIN_URL);
    }

    private void checkCookies(String currentUrl) {
        CookieManager cookieManager = CookieManager.getInstance();
        String cookies = cookieManager.getCookie("https://open.spotify.com");
        if (cookies == null || cookies.isEmpty()) {
            cookies = cookieManager.getCookie("https://accounts.spotify.com");
        }

        if (cookies != null && cookies.contains("sp_dc=")) {
            String spDc = extractCookieValue(cookies, "sp_dc");
            if (spDc != null && !spDc.isEmpty()) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                        .putString(KEY_SP_DC, spDc)
                        .putString(KEY_ALL_COOKIES, cookies)
                        .apply();

                if (currentUrl != null && currentUrl.contains("open.spotify.com")) {
                    handler.postDelayed(this::completeLogin, 800);
                }
            }
        }
    }

    private void completeLogin() {
        if (isFinished) return;
        isFinished = true;
        setResult(RESULT_OK);
        finish();
    }

    private String extractCookieValue(String cookies, String key) {
        String[] pairs = cookies.split(";");
        for (String pair : pairs) {
            String trimmed = pair.trim();
            if (trimmed.startsWith(key + "=")) {
                return trimmed.substring((key + "=").length());
            }
        }
        return null;
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
