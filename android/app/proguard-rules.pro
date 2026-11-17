# ProGuard rules for MySpotify
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class dev.margbug.vinyl.WebAppInterface { *; }
