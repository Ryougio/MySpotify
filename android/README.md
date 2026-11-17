# MySpotify Android Edition

基于桌面端 `MySpotify` 原生视觉与交互规范重构的 Android 移动端工程。

---

## 🎨 视觉与交互规范（遵循桌面端 1:1 还原）

- **主色调与氛围**：
  - 核心背景：`#141416`
  - 侧边栏与表层：`#1C1C1F`
  - 主文字：`#F5F5F7`
  - 辅文字：`rgba(235, 235, 245, 0.56)`
  - 强调色：Spotify Green `#1ED760`
  - 细分界线：`rgba(255, 255, 255, 0.07)`
- **桌面级布局还原**：
  - **侧边栏 (Sidebar: 232px)**：包含「首页」、「每日推荐」、「排行榜」、「浏览全部」、「已点赞歌曲」、「最近播放」与「设置」。大屏/平板常驻，手机端支持平滑抽屉弹出。
  - **常驻播放栏 (Player Bar: 76px)**：底部常驻，左侧封面元数据与喜欢按钮，中间播放控制键与彗星光尾进度条，右侧音量与全屏展开。
  - **全屏正在播放舞台 (Now Playing Stage)**：动态高斯模糊氛围背景，左侧带微光反光与旋转动效的黑胶唱片封面，右侧逐字同步平滑滚动歌词（支持中文翻译对照与点击跳转时间点）。
  - **手势交互**：全屏正在播放页支持下滑手势流畅折叠回底部 Mini 播放条。

---

## 🚀 核心架构与功能改造

1. **真实 Spotify 登录与 Token 拦截**：
   - 包含专属 `SpotifyLoginActivity`，使用深色原生标题栏加载官方登录页。
   - 自动拦截并提取 `open.spotify.com` 的 `sp_dc` 凭据，本地加密持久化并自动换取 `accessToken`。
   - 支持未登录时的官方访客身份（Guest Token），无需账号即可搜索和浏览全站音乐。
2. **原生后台音频播放与媒体中心 (MediaSession)**：
   - 采用 Android 原生 `MediaPlaybackService` 前台服务（带有 `FOREGROUND_SERVICE_MEDIA_PLAYBACK` 与 `WakeLock`/`WifiLock` 保护），彻底杜绝息屏或切后台被系统杀掉。
   - 深度集成 Android `MediaSessionCompat` 与 `NotificationCompat.MediaStyle`：支持锁屏控制卡片、下拉通知栏大封面、耳机/车载蓝牙硬件按键切歌以及拔出耳机自动暂停（`AUDIO_BECOMING_NOISY`）。
3. **多源逐字同步歌词引擎**：
   - 内置多级歌词检索链：优先精确匹配 LRCLIB 带时间轴歌词，次选网易云音乐时间轴与中文翻译歌词。
   - 毫秒级时间轴对齐，高亮放大当前播放行并自动平滑居中滚动。
4. **实时搜索与双向进度同步**：
   - 搜索框支持实时输入防抖，直接联动 Spotify Web API，点击曲目无缝加入播放队列。
   - 原生播放器以 500ms 频率双向同步播放进度、时长与播放状态给 Web 前端。

---

## 🛠️ 构建与产物

### 方式 1：GitHub Actions 自动构建 (推荐)
将代码推送到你的 GitHub Fork 仓库后，GitHub Actions 会自动触发 `.github/workflows/build-android-apk.yml`，在云端 Ubuntu 环境下自动编译出 Debug APK，并在 Actions 页面的 Artifacts 中直接提供下载。

### 方式 2：本地编译
在配置了 Android SDK 的环境中，进入 `android` 目录执行：
```bash
gradle assembleDebug
```
产物位置：`android/app/build/outputs/apk/debug/app-debug.apk`。
