package dev.margbug.vinyl;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class SpotifyLoginActivity extends AppCompatActivity {

    public static final String PREFS_NAME = "spotify_prefs";
    public static final String KEY_SP_DC = "sp_dc";
    public static final String LOGIN_URL = "https://accounts.spotify.com/zh-CN/login?continue=https%3A%2F%2Fopen.spotify.com%2F";

    private WebView webView;
    private ProgressBar progressBar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_spotify_login);

        // Configure dark status and navigation bars
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
        settings.setUserAgentString(settings.getUserAgentString().replace("; wv", "") + " MySpotifyAndroid/0.4.29");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

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
                checkCookiesAndFinish(request.getUrl().toString());
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                checkCookiesAndFinish(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                checkCookiesAndFinish(url);
            }
        });

        webView.loadUrl(LOGIN_URL);
    }

    private void checkCookiesAndFinish(String currentUrl) {
        CookieManager cookieManager = CookieManager.getInstance();
        String cookies = cookieManager.getCookie("https://open.spotify.com");
        if (cookies != null && cookies.contains("sp_dc=")) {
            String spDc = extractCookieValue(cookies, "sp_dc");
            if (spDc != null && !spDc.isEmpty()) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(KEY_SP_DC, spDc).apply();
                setResult(RESULT_OK);
                finish();
            }
        }
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
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
