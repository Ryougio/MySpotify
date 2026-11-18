package dev.margbug.vinyl;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
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

        getWindow().setStatusBarColor(Color.parseColor("#121212"));
        getWindow().setNavigationBarColor(Color.parseColor("#121212"));

        ImageButton btnClose = findViewById(R.id.btnLoginClose);
        TextView tvTitle = findViewById(R.id.tvLoginTitle);
        TextView btnManualCookie = findViewById(R.id.btnManualCookie);
        progressBar = findViewById(R.id.loginProgressBar);
        webView = findViewById(R.id.loginWebView);

        tvTitle.setText("登录 Spotify 账号");
        btnClose.setOnClickListener(v -> finish());
        if (btnManualCookie != null) {
            btnManualCookie.setOnClickListener(v -> showManualCookieDialog());
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);

        // Fix: Use genuine clean Mobile Chrome UA without "; wv" or "Version/4.0" to avoid Google's "This browser or app may not be secure" block
        String defaultUa = settings.getUserAgentString();
        String cleanUa = (defaultUa != null) ? defaultUa.replace("; wv", "").replace("Version/4.0 ", "") : "";
        if (!cleanUa.contains("Chrome/")) {
            cleanUa = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
        }
        settings.setUserAgentString(cleanUa);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void onIdentityCaptured(String payloadJson) {
                try {
                    JSONObject j = new JSONObject(payloadJson);
                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    SharedPreferences.Editor ed = prefs.edit();
                    String ct = j.optString("clientToken", "");
                    if (!ct.isEmpty()) {
                        ed.putString(SpotifyApiClient.KEY_CLIENT_TOKEN, ct);
                        ed.putLong(SpotifyApiClient.KEY_CLIENT_TOKEN_EXPIRES, System.currentTimeMillis() + 14L * 86400_000L);
                    }
                    JSONObject tok = j.optJSONObject("token");
                    if (tok != null) {
                        String at = tok.optString("accessToken", "");
                        boolean anon = tok.optBoolean("isAnonymous", true);
                        long exp = tok.optLong("accessTokenExpirationTimestampMs", System.currentTimeMillis() + 1800_000L);
                        if (!at.isEmpty() && !anon) {
                            ed.putString(KEY_ACCESS_TOKEN, at);
                            ed.putBoolean(SpotifyApiClient.KEY_ACCESS_TOKEN_ANON, false);
                            ed.putLong(SpotifyApiClient.KEY_ACCESS_TOKEN_EXPIRES, exp);
                        }
                    }
                    ed.commit();
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

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView popupWebView = new WebView(SpotifyLoginActivity.this);
                WebSettings popupSettings = popupWebView.getSettings();
                popupSettings.setJavaScriptEnabled(true);
                popupSettings.setDomStorageEnabled(true);
                popupSettings.setUserAgentString(settings.getUserAgentString());
                CookieManager.getInstance().setAcceptThirdPartyCookies(popupWebView, true);
                popupWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView v, String url) {
                        checkCookies(url);
                    }
                });
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
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
                if (url != null && url.contains("open.spotify.com")) {
                    injectCaptureJs(view);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                checkCookies(url);

                if (url != null && url.contains("open.spotify.com")) {
                    injectCaptureJs(view);
                    CookieManager cm = CookieManager.getInstance();
                    String cookies = cm.getCookie("https://open.spotify.com");
                    if (cookies != null && cookies.contains("sp_dc=")) {
                        // Give open.spotify.com up to 2.5s to also capture clientToken + accessToken
                        handler.postDelayed(() -> {
                            if (webView != null && !isFinished) {
                                webView.evaluateJavascript("if(window.__vinyl && window.SpotifyLoginCapture) window.SpotifyLoginCapture.onIdentityCaptured(JSON.stringify(window.__vinyl));", null);
                            }
                        }, 1500);
                        handler.postDelayed(SpotifyLoginActivity.this::completeLogin, 2500);
                    }
                }
            }
        });

        webView.loadUrl(LOGIN_URL);
    }

    private void injectCaptureJs(WebView view) {
        String js = "(() => {" +
                "if (window.__vinylInstalled) return; window.__vinylInstalled = true;" +
                "const v = (window.__vinyl = {});" +
                "const wanted = /\\/api\\/token|clienttoken/;" +
                "const notify = () => { try { if (window.SpotifyLoginCapture) window.SpotifyLoginCapture.onIdentityCaptured(JSON.stringify(v)); } catch(e){} };" +
                "const keep = (u, t) => { try { const j = JSON.parse(t); if (/\\/api\\/token/.test(u) && j.accessToken) { v.token = j; notify(); } if (/clienttoken/.test(u) && j.granted_token) { v.clientToken = j.granted_token.token; notify(); } } catch(e){} };" +
                "const f0 = window.fetch;" +
                "window.fetch = function(input, init) {" +
                "  const u = typeof input === 'string' ? input : (input && input.url) || String(input);" +
                "  const p = f0.apply(this, arguments);" +
                "  if (wanted.test(u)) p.then(r => r.clone().text()).then(t => keep(u, t)).catch(()=>{});" +
                "  return p;" +
                "};" +
                "})();";
        view.evaluateJavascript(js, null);
    }

    private void showManualCookieDialog() {
        final EditText input = new EditText(this);
        input.setHint("粘贴 sp_dc Cookie 字符串");
        input.setSingleLine(false);
        input.setMaxLines(4);
        input.setPadding(40, 30, 40, 30);

        new AlertDialog.Builder(this)
                .setTitle("手动输入 Cookie (sp_dc)")
                .setMessage("若 Google 登录提示「浏览器不安全」，推荐：\n\n1. 【最稳定推荐】在浏览器访问 spotify.com/password-reset 使用 Google 邮箱设置独立密码，即可直接用邮箱+密码登录。\n\n2. 或在手机/电脑浏览器中登录 open.spotify.com，在 Cookie 中复制 sp_dc 属性值并粘贴在下方：")
                .setView(input)
                .setPositiveButton("确认登录", (dialog, which) -> {
                    String text = input.getText().toString().trim();
                    if (text.contains("sp_dc=")) {
                        text = text.substring(text.indexOf("sp_dc=") + 6);
                        if (text.contains(";")) {
                            text = text.substring(0, text.indexOf(";"));
                        }
                        text = text.trim();
                    }
                    if (!text.isEmpty()) {
                        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                        prefs.edit()
                                .putString(KEY_SP_DC, text)
                                .putString(KEY_ALL_COOKIES, "sp_dc=" + text)
                                .remove(KEY_ACCESS_TOKEN)
                                .remove(SpotifyApiClient.KEY_ACCESS_TOKEN_ANON)
                                .remove(SpotifyApiClient.KEY_ACCESS_TOKEN_EXPIRES)
                                .commit();
                        Toast.makeText(this, "Cookie 导入成功，正在同步...", Toast.LENGTH_SHORT).show();
                        completeLogin();
                    } else {
                        Toast.makeText(this, "输入的 Cookie 不能为空", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("取消", null)
                .show();
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
                CookieManager.getInstance().flush();
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                        .putString(KEY_SP_DC, spDc)
                        .putString(KEY_ALL_COOKIES, "sp_dc=" + spDc)
                        .remove(KEY_ACCESS_TOKEN)
                        .remove(SpotifyApiClient.KEY_ACCESS_TOKEN_ANON)
                        .remove(SpotifyApiClient.KEY_ACCESS_TOKEN_EXPIRES)
                        .commit();

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
