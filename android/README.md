# MySpotify Android Edition

基于桌面端 `MySpotify` 原生视觉与交互规范重构的 Android 移动端工程。

---

## 🎨 视觉与交互规范（遵循桌面端）

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
  - **全屏正在播放舞台 (Now Playing Stage)**：动态高斯模糊氛围背景，左侧黑胶质感大封面，右侧逐字同步平滑滚动歌词（支持翻译对照）。

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
