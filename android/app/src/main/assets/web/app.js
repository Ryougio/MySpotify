/**
 * MySpotify - Apple Design Edition UI Engine
 * Grounded in Apple HIG: Liquid Glass, Dynamic Aura Mesh,
 * Apple Music Synced Lyrics & Native Android Bridge
 */

(function () {
    // 默认高保真推荐曲库 (含高精封面与多源歌词)
    const FEATURED_TRACKS = [
        {
            id: "sp-1",
            title: "Starboy",
            artist: "The Weeknd, Daft Punk",
            album: "Starboy",
            duration: 230,
            cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=85",
            aura1: "rgba(225, 45, 57, 0.65)",
            aura2: "rgba(255, 90, 40, 0.45)",
            audioUrl: "https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3",
            lyrics: [
                { time: 0, text: "I'm tryna put you in the worst mood, ah", trans: "我要让你尝尝最糟糕的心情" },
                { time: 4, text: "P1 cleaner than your church shoes, ah", trans: "我的迈凯伦 P1 比你做礼拜的皮鞋还要光亮" },
                { time: 8, text: "Milli point two just to hurt you, ah", trans: "花了 120 万美元只为刺痛你的心" },
                { time: 12, text: "All red Lamb' just to tease you, ah", trans: "全红的兰博基尼只为挑逗你" },
                { time: 16, text: "None of these toys on lease too, ah", trans: "这些玩具可都不是租来的" },
                { time: 20, text: "Made your whole year in a week too, yah", trans: "我一周就能赚到你一整年的收入" },
                { time: 24, text: "Main bitch out your league too, ah", trans: "我的正牌女友你根本高攀不起" },
                { time: 28, text: "Side bitch out of your league too, ah", trans: "就连备选你也望尘莫及" },
                { time: 32, text: "Look what you've done", trans: "看看你都干了些什么" },
                { time: 35, text: "I'm a motherfuckin' starboy", trans: "我就是那个耀眼的狂徒巨星" },
                { time: 40, text: "Look what you've done", trans: "看看你都做了什么" },
                { time: 44, text: "I'm a motherfuckin' starboy", trans: "不可一世的传奇巨星" }
            ]
        },
        {
            id: "sp-2",
            title: "Blinding Lights",
            artist: "The Weeknd",
            album: "After Hours",
            duration: 200,
            cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=85",
            aura1: "rgba(220, 60, 20, 0.65)",
            aura2: "rgba(180, 20, 100, 0.45)",
            audioUrl: "https://cdn.freesound.org/previews/612/612092_5674468-lq.mp3",
            lyrics: [
                { time: 0, text: "Yeah", trans: "Yeah" },
                { time: 3, text: "I've been tryna call", trans: "我一直想拨通你的电话" },
                { time: 6, text: "I've been on my own for long enough", trans: "我独自一人的时间已经太久" },
                { time: 10, text: "Maybe you can show me how to love, maybe", trans: "或许你能教会我该如何去爱" },
                { time: 15, text: "I'm going through withdrawals", trans: "我正承受着思念的煎熬" },
                { time: 18, text: "You don't even have to do too much", trans: "你甚至不需要做太多" },
                { time: 22, text: "You can turn me on with just a touch, baby", trans: "只需轻轻一触就能将我彻底点燃" },
                { time: 27, text: "I look around and Sin City's cold and empty", trans: "环顾四周，罪恶之城冰冷而空虚" },
                { time: 32, text: "No one's around to judge me", trans: "再没有人在身旁对我评头论足" },
                { time: 36, text: "I can't see clearly when you're gone", trans: "当你离去，我的世界一片昏暗" },
                { time: 40, text: "I said, ooh, I'm blinded by the lights", trans: "我说，霓虹炫目，令我双眼迷离" }
            ]
        },
        {
            id: "sp-3",
            title: "Cruel Summer",
            artist: "Taylor Swift",
            album: "Lover",
            duration: 178,
            cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=85",
            aura1: "rgba(40, 130, 235, 0.65)",
            aura2: "rgba(220, 80, 160, 0.45)",
            audioUrl: "https://cdn.freesound.org/previews/612/612088_5674468-lq.mp3",
            lyrics: [
                { time: 0, text: "Fever dream high in the quiet of the night", trans: "沉寂黑夜里高烧般的幻梦" },
                { time: 4, text: "You know that I caught it", trans: "你知道我已深陷其中" },
                { time: 7, text: "Bad, bad boy, shiny toy with a price", trans: "坏男孩，明码标价的耀眼玩偶" },
                { time: 11, text: "You know that I bought it", trans: "你知道我早已将你买下" },
                { time: 14, text: "Killing me slow, out the window", trans: "从窗外吹来的风慢条斯理地折磨着我" },
                { time: 18, text: "I'm always waiting for you to be waiting below", trans: "我总在等待着你在楼下守候" },
                { time: 22, text: "Devils roll the dice, angels roll their eyes", trans: "恶魔掷下骰子，天使翻了白眼" },
                { time: 26, text: "What doesn't kill me makes me want you more", trans: "那些杀不死我的，只会让我更加渴望你" },
                { time: 30, text: "And it's new, the shape of your body", trans: "那是种全新感觉，你身体的轮廓" },
                { time: 34, text: "It's blue, the feeling I've got", trans: "如深蓝般忧郁，涌上心头的感觉" },
                { time: 38, text: "It's a cruel summer", trans: "这是一个残酷无情的盛夏" }
            ]
        }
    ];

    // 全局曲目注册表 (解决搜索、歌单与精选点击失效问题)
    const trackRegistry = new Map();

    function registerTrack(track) {
        if (!track || !track.id) return;
        trackRegistry.set(track.id, track);
    }

    FEATURED_TRACKS.forEach(registerTrack);

    // 应用运行时状态
    const state = {
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        shuffle: false,
        repeat: false,
        isNowPlayingOpen: false,
        activeLyricIndex: -1,
        likedTrackIds: new Set(["sp-1"]),
        likedTracks: [...FEATURED_TRACKS.slice(0, 1)],
        userPlaylists: [],
        historyTracks: [],
        playlistQueue: [...FEATURED_TRACKS],
        currentViewingPlaylist: null,
        user: {
            isLoggedIn: false,
            isGuest: true,
            name: "访客模式",
            email: "",
            avatar: "访",
            avatarUrl: null,
            product: "free"
        },
        accessToken: null
    };

    // 原生交互桥接对象
    const Native = {
        toast(msg) {
            if (window.AndroidBridge && window.AndroidBridge.showToast) {
                window.AndroidBridge.showToast(msg);
            }
        },
        vibrate(ms) {
            if (window.AndroidBridge && window.AndroidBridge.vibrate) {
                window.AndroidBridge.vibrate(ms || 18);
            }
        },
        login() {
            if (window.AndroidBridge && window.AndroidBridge.startSpotifyLogin) {
                window.AndroidBridge.startSpotifyLogin();
            } else {
                Native.toast("请在 Android 客户端环境内登录");
            }
        },
        logout() {
            if (window.AndroidBridge && window.AndroidBridge.logout) {
                window.AndroidBridge.logout();
            }
        },
        getLoginStatus() {
            if (window.AndroidBridge && window.AndroidBridge.getLoginStatus) {
                try {
                    return JSON.parse(window.AndroidBridge.getLoginStatus());
                } catch (e) {
                    return { isLoggedIn: false, isGuest: true };
                }
            }
            return { isLoggedIn: false, isGuest: true };
        },
        fetchToken(callback) {
            if (window.AndroidBridge && window.AndroidBridge.fetchAccessToken) {
                const cbName = "_cbToken_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.fetchAccessToken("window." + cbName);
            } else {
                callback("No native bridge", null);
            }
        },
        fetchWebApi(path, token, method, body, callback) {
            if (window.AndroidBridge && window.AndroidBridge.fetchWebApi) {
                const cbName = "_cbApi_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.fetchWebApi(path, token, method, body || "", "window." + cbName);
            } else {
                callback("No native bridge", null);
            }
        },
        fetchLyrics(trackId, title, artist, durationSec, callback) {
            if (window.AndroidBridge && window.AndroidBridge.fetchLyrics) {
                const cbName = "_cbLyrics_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : []);
                };
                window.AndroidBridge.fetchLyrics(trackId, title, artist, durationSec, "window." + cbName);
            } else {
                callback("No native bridge", []);
            }
        },
        resolveAudioUrl(title, artist, callback) {
            if (window.AndroidBridge && window.AndroidBridge.resolveAudioUrl) {
                const cbName = "_cbAudio_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.resolveAudioUrl(title, artist, "window." + cbName);
            } else {
                callback("No native bridge", null);
            }
        },
        getCacheSize(callback) {
            if (window.AndroidBridge && window.AndroidBridge.getCacheSize) {
                const cbName = "_cbCache_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.getCacheSize("window." + cbName);
            } else {
                callback(null, { formatted: "0 B" });
            }
        },
        clearCache(callback) {
            if (window.AndroidBridge && window.AndroidBridge.clearCache) {
                const cbName = "_cbClear_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, success) {
                    delete window[cbName];
                    callback(err, success);
                };
                window.AndroidBridge.clearCache("window." + cbName);
            } else {
                callback(null, true);
            }
        },
        playAudio(url, title, artist, album, coverUrl) {
            if (window.AndroidBridge && window.AndroidBridge.playTrack) {
                window.AndroidBridge.playTrack(url || "", title, artist, album || "Spotify", coverUrl || "");
            }
        },
        pauseAudio() {
            if (window.AndroidBridge && window.AndroidBridge.pauseTrack) {
                window.AndroidBridge.pauseTrack();
            }
        },
        resumeAudio() {
            if (window.AndroidBridge && window.AndroidBridge.resumeTrack) {
                window.AndroidBridge.resumeTrack();
            }
        },
        seekAudio(posMs) {
            if (window.AndroidBridge && window.AndroidBridge.seekTo) {
                window.AndroidBridge.seekTo(posMs);
            }
        }
    };

    // DOM 元素引用
    const barTrackCover = document.getElementById("barTrackCover");
    const barTrackTitle = document.getElementById("barTrackTitle");
    const barTrackArtist = document.getElementById("barTrackArtist");
    const barCoverWrap = document.getElementById("barCoverWrap");
    const barBtnLike = document.getElementById("barBtnLike");

    const btnPlayPause = document.getElementById("btnPlayPause");
    const iconPlay = document.getElementById("iconPlay");
    const iconPause = document.getElementById("iconPause");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const miniProgressFill = document.getElementById("miniProgressFill");

    // 全屏 Sheet 元素
    const nowPlayingOverlay = document.getElementById("nowPlayingOverlay");
    const btnCloseNowPlaying = document.getElementById("btnCloseNowPlaying");
    const artworkFrame = document.getElementById("artworkFrame");
    const npLargeCover = document.getElementById("npLargeCover");
    const npSongName = document.getElementById("npSongName");
    const npArtistName = document.getElementById("npArtistName");
    const npBtnLike = document.getElementById("npBtnLike");
    const scrubberTrack = document.getElementById("scrubberTrack");
    const scrubberFill = document.getElementById("scrubberFill");
    const timeCurrent = document.getElementById("timeCurrent");
    const timeDuration = document.getElementById("timeDuration");

    const sheetBtnPlayPause = document.getElementById("sheetBtnPlayPause");
    const sheetIconPlay = document.getElementById("sheetIconPlay");
    const sheetIconPause = document.getElementById("sheetIconPause");
    const sheetBtnPrev = document.getElementById("sheetBtnPrev");
    const sheetBtnNext = document.getElementById("sheetBtnNext");
    const btnShuffle = document.getElementById("btnShuffle");
    const btnRepeat = document.getElementById("btnRepeat");

    const lyricsContainer = document.getElementById("lyricsContainer");
    const lyricsWrapper = document.getElementById("lyricsWrapper");

    // 动态流光背景元素
    const orb1 = document.getElementById("orb1");
    const orb2 = document.getElementById("orb2");
    const aura1 = document.getElementById("aura1");
    const aura2 = document.getElementById("aura2");

    // 导航与搜索
    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    const appSidebar = document.getElementById("appSidebar");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const btnLogin = document.getElementById("btnLogin");
    const userPill = document.getElementById("userPill");
    const sidebarAvatar = document.getElementById("sidebarAvatar");
    const sidebarUserName = document.getElementById("sidebarUserName");
    const sidebarUserSub = document.getElementById("sidebarUserSub");
    const userPlaylistsNav = document.getElementById("userPlaylistsNav");

    // 时间格式化 (mm:ss)
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    // 问候语更新
    function updateGreeting() {
        const hour = new Date().getHours();
        let greeting = "晚上好";
        if (hour >= 5 && hour < 12) greeting = "早上好";
        else if (hour >= 12 && hour < 18) greeting = "下午好";
        const el = document.getElementById("homeGreeting");
        if (el) el.textContent = greeting;
    }

    // ==========================================================
    // UI 初始化与内容渲染
    // ==========================================================
    function initUI() {
        updateGreeting();

        // 快捷精选胶囊卡片
        const quickGrid = document.getElementById("quickGrid");
        if (quickGrid) {
            quickGrid.innerHTML = FEATURED_TRACKS.map(t => `
                <div class="quick-card" data-track-id="${t.id}">
                    <img src="${t.cover}" class="quick-thumb" alt="${t.title}">
                    <div class="quick-title">${t.title}</div>
                </div>
            `).join("");
        }

        // 每日精选横向橱窗
        const dailyMixes = document.getElementById("dailyMixes");
        if (dailyMixes) {
            dailyMixes.innerHTML = FEATURED_TRACKS.map(t => `
                <div class="media-card" data-track-id="${t.id}">
                    <div class="media-card-img-wrap">
                        <img src="${t.cover}" class="media-card-img" alt="${t.title}">
                        <div class="card-play-btn">
                            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                        </div>
                    </div>
                    <div class="media-card-title">${t.title}</div>
                    <div class="media-card-desc">${t.artist}</div>
                </div>
            `).join("");
        }

        // 热门单曲榜
        renderTrackList(document.getElementById("homeTopTracksBody"), FEATURED_TRACKS);

        // 排行榜
        const chartsGrid = document.getElementById("chartsGrid");
        if (chartsGrid) {
            chartsGrid.innerHTML = `
                <div class="quick-card" data-track-id="sp-1">
                    <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80" class="quick-thumb" alt="Top 50">
                    <div class="quick-title">全球热门 50 强</div>
                </div>
                <div class="quick-card" data-track-id="sp-2">
                    <img src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&q=80" class="quick-thumb" alt="Viral 50">
                    <div class="quick-title">流行热搜榜</div>
                </div>
            `;
        }

        // 浏览全部分类
        const browseGrid = document.getElementById("browseGrid");
        if (browseGrid) {
            const categories = [
                { name: "流行", color: "#8d67ab" },
                { name: "摇滚", color: "#e91429" },
                { name: "嘻哈", color: "#bc5900" },
                { name: "电子/舞曲", color: "#0d73ec" },
                { name: "独立音乐", color: "#509bf5" },
                { name: "专注与放松", color: "#1e3264" }
            ];
            browseGrid.innerHTML = categories.map(c => `
                <div style="background-color: ${c.color}; height: 96px; border-radius: 14px; padding: 16px; font-weight: 700; font-size: 16px; color: #fff; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,0.35);">
                    ${c.name}
                </div>
            `).join("");
        }

        // 每日推荐列表
        renderTrackList(document.getElementById("dailyTracksBody"), FEATURED_TRACKS);

        // 最近播放列表
        renderTrackList(document.getElementById("recentTracksBody"), state.historyTracks);

        // 载入第一首歌
        loadTrack(FEATURED_TRACKS[0]);

        // 读取与更新缓存大小
        refreshCacheDisplay();

        // 检查登录状态并同步个人歌单与资料库
        syncSpotifyUserData(false);
    }

    function renderTrackList(container, tracks) {
        if (!container) return;
        if (!tracks || tracks.length === 0) {
            container.innerHTML = `<div class="empty-state-view"><span class="empty-text">暂无曲目</span></div>`;
            return;
        }

        tracks.forEach(registerTrack);

        container.innerHTML = tracks.map((t, idx) => `
            <div class="apple-track-row" data-track-id="${t.id}">
                <span class="track-index-num">${idx + 1}</span>
                <img src="${t.cover || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300'}" class="track-artwork-thumb" alt="${t.title}" loading="lazy">
                <div class="track-info-col">
                    <span class="track-name-text">${t.title}</span>
                    <span class="track-artist-text">${t.artist}</span>
                </div>
                <span class="track-album-text">${t.album || ""}</span>
                <span class="track-duration-text">${formatTime(t.duration)}</span>
            </div>
        `).join("");
    }

    // ==========================================================
    // Spotify 云端账户与资料库深度同步 (核心修复)
    // ==========================================================
    function syncSpotifyUserData(manualFeedback) {
        const loginStatus = Native.getLoginStatus();

        if (!loginStatus.isLoggedIn) {
            // 访客模式
            state.user.isLoggedIn = false;
            state.user.isGuest = true;
            state.user.name = "访客模式";
            state.user.email = "";
            state.user.avatar = "访";
            state.user.avatarUrl = null;

            btnLogin.style.display = "block";
            sidebarAvatar.innerHTML = "访";
            sidebarUserName.textContent = "访客模式";
            sidebarUserSub.textContent = "点击登录 Spotify";

            userPlaylistsNav.innerHTML = `<div class="nav-empty-hint">登录 Spotify 后自动同步</div>`;

            // 设置页对应
            document.getElementById("settingsUserAvatar").innerHTML = "访";
            document.getElementById("settingsAccountName").textContent = "未登录 (访客身份)";
            document.getElementById("settingsAccountEmail").textContent = "登录后同步个人 Spotify 歌单与已点赞音乐";
            document.getElementById("settingsAccountTier").textContent = "免费试用";
            document.getElementById("settingsAccountTier").style.background = "rgba(255,255,255,0.1)";
            document.getElementById("settingsAccountTier").style.color = "rgba(255,255,255,0.6)";
            document.getElementById("btnSettingsLogin").style.display = "inline-block";
            document.getElementById("btnSettingsLogout").style.display = "none";
            document.getElementById("settingsSyncStatus").textContent = "未登录，无法同步";

            if (manualFeedback) Native.toast("请先登录 Spotify 账号");
            return;
        }

        // 已登录，获取 Access Token
        if (manualFeedback) Native.toast("正在同步云端资料库...");

        Native.fetchToken((err, res) => {
            if (err || !res || !res.accessToken) {
                if (manualFeedback) Native.toast("Token 获取失败，请检查网络或重新登录");
                return;
            }

            state.accessToken = res.accessToken;
            state.user.isLoggedIn = true;
            state.user.isGuest = false;

            btnLogin.style.display = "none";
            document.getElementById("btnSettingsLogin").style.display = "none";
            document.getElementById("btnSettingsLogout").style.display = "inline-block";

            // 1. 同步个人资料 Profile (/v1/me)
            Native.fetchWebApi("me", state.accessToken, "GET", null, (errMe, meData) => {
                if (!errMe && meData) {
                    state.user.name = meData.display_name || meData.id || "Spotify 会员";
                    state.user.email = meData.email || "已绑定 Spotify 账号";
                    state.user.product = meData.product || "premium";

                    const avatarUrl = meData.images?.[0]?.url;
                    state.user.avatarUrl = avatarUrl;
                    const initialChar = state.user.name.charAt(0).toUpperCase();

                    if (avatarUrl) {
                        sidebarAvatar.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="Avatar">`;
                        document.getElementById("settingsUserAvatar").innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="Avatar">`;
                    } else {
                        sidebarAvatar.innerHTML = initialChar;
                        document.getElementById("settingsUserAvatar").innerHTML = initialChar;
                    }

                    sidebarUserName.textContent = state.user.name;
                    sidebarUserSub.textContent = state.user.product === "premium" ? "Spotify Premium 会员" : "Spotify 账号在线";

                    document.getElementById("settingsAccountName").textContent = state.user.name;
                    document.getElementById("settingsAccountEmail").textContent = state.user.email;
                    const tierEl = document.getElementById("settingsAccountTier");
                    tierEl.textContent = state.user.product === "premium" ? "Premium 订阅" : "普通会员";
                    tierEl.style.background = "rgba(30, 215, 96, 0.15)";
                    tierEl.style.color = "var(--spotify-green)";
                }
            });

            // 2. 同步用户歌单 Playlists (/v1/me/playlists)
            Native.fetchWebApi("me/playlists?limit=50", state.accessToken, "GET", null, (errPl, plData) => {
                if (!errPl && plData && plData.items) {
                    state.userPlaylists = plData.items.map(p => ({
                        id: p.id,
                        name: p.name,
                        cover: p.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300",
                        trackCount: p.tracks?.total || 0,
                        owner: p.owner?.display_name || "Spotify",
                        description: p.description || ""
                    }));

                    renderUserPlaylistsNav(state.userPlaylists);
                }
                updateSyncStatusDisplay();
            });

            // 3. 同步已点赞歌曲 Tracks (/v1/me/tracks)
            Native.fetchWebApi("me/tracks?limit=50", state.accessToken, "GET", null, (errTracks, tracksData) => {
                if (!errTracks && tracksData && tracksData.items && tracksData.items.length > 0) {
                    const likedList = tracksData.items.map(item => {
                        const t = item.track;
                        return {
                            id: t.id,
                            title: t.name,
                            artist: t.artists ? t.artists.map(a => a.name).join(", ") : "未知歌手",
                            album: t.album ? t.album.name : "",
                            duration: Math.round(t.duration_ms / 1000),
                            cover: t.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300",
                            audioUrl: t.preview_url || ("resolve:" + t.name),
                            aura1: "rgba(160, 40, 180, 0.55)",
                            aura2: "rgba(10, 132, 255, 0.45)"
                        };
                    });

                    state.likedTracks = likedList;
                    state.likedTrackIds = new Set(likedList.map(t => t.id));
                    likedList.forEach(registerTrack);

                    document.getElementById("likedCountLabel").textContent = `共 ${likedList.length} 首歌曲`;
                    renderTrackList(document.getElementById("likedTracksBody"), likedList);
                }
                updateSyncStatusDisplay();
                if (manualFeedback) Native.toast("云端资料库同步完成！");
            });
        });
    }

    function updateSyncStatusDisplay() {
        const syncStatusEl = document.getElementById("settingsSyncStatus");
        if (syncStatusEl) {
            syncStatusEl.textContent = `已同步 ${state.userPlaylists.length} 个歌单 · ${state.likedTrackIds.size} 首已点赞歌曲`;
        }
    }

    // 渲染侧边栏“我的歌单”
    function renderUserPlaylistsNav(playlists) {
        if (!userPlaylistsNav) return;
        if (!playlists || playlists.length === 0) {
            userPlaylistsNav.innerHTML = `<div class="nav-empty-hint">暂无自建歌单</div>`;
            return;
        }

        userPlaylistsNav.innerHTML = playlists.map(p => `
            <div class="user-playlist-item" data-playlist-id="${p.id}">
                <img src="${p.cover}" class="playlist-item-thumb" alt="${p.name}" loading="lazy">
                <div class="playlist-item-meta">
                    <span class="playlist-item-name">${p.name}</span>
                    <span class="playlist-item-count">${p.trackCount} 首歌曲</span>
                </div>
            </div>
        `).join("");
    }

    // 打开歌单详情页 (完整还原桌面端 pagePlaylist)
    function openPlaylist(playlistId, name, cover, owner, count, description) {
        switchPage("playlist");
        state.currentViewingPlaylist = { id: playlistId, name, cover, owner, count, description };

        const coverImg = document.getElementById("playlistCoverImg");
        const titleText = document.getElementById("playlistTitleText");
        const metaText = document.getElementById("playlistMetaText");
        const container = document.getElementById("playlistTracksBody");

        if (coverImg) coverImg.src = cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600";
        if (titleText) titleText.textContent = name || "歌单";
        if (metaText) metaText.textContent = `${owner || "创建者"} · ${count || 0} 首歌曲`;
        if (container) container.innerHTML = `<div class="empty-state-view"><span class="empty-text">正在加载歌单曲目...</span></div>`;

        if (state.accessToken) {
            Native.fetchWebApi(`playlists/${playlistId}/tracks?limit=50`, state.accessToken, "GET", null, (err, res) => {
                if (!err && res && res.items && res.items.length > 0) {
                    const tracks = res.items.filter(it => it.track).map(it => {
                        const t = it.track;
                        return {
                            id: t.id,
                            title: t.name,
                            artist: t.artists ? t.artists.map(a => a.name).join(", ") : "未知歌手",
                            album: t.album ? t.album.name : "",
                            duration: Math.round(t.duration_ms / 1000),
                            cover: t.album?.images?.[0]?.url || cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300",
                            audioUrl: t.preview_url || ("resolve:" + t.name),
                            aura1: "rgba(30, 215, 96, 0.5)",
                            aura2: "rgba(0, 122, 255, 0.45)"
                        };
                    });

                    state.currentViewingPlaylist.tracks = tracks;
                    renderTrackList(container, tracks);
                } else {
                    if (container) container.innerHTML = `<div class="empty-state-view"><span class="empty-text">此歌单为空或加载失败</span></div>`;
                }
            });
        }
    }

    // ==========================================================
    // 播放核心引擎与全局事件代理 (彻底解决点击失效)
    // ==========================================================
    function loadTrack(track) {
        if (!track) return;
        state.currentTrack = track;
        registerTrack(track);

        barTrackTitle.textContent = track.title;
        barTrackArtist.textContent = track.artist;
        barTrackCover.src = track.cover;

        npSongName.textContent = track.title;
        npArtistName.textContent = track.artist;
        npLargeCover.src = track.cover;
        timeDuration.textContent = formatTime(track.duration);

        // 动态环境流光着色
        const c1 = track.aura1 || "rgba(30, 215, 96, 0.6)";
        const c2 = track.aura2 || "rgba(10, 132, 255, 0.45)";
        if (aura1) aura1.style.background = `radial-gradient(circle, ${c1} 0%, transparent 70%)`;
        if (orb1) orb1.style.background = `radial-gradient(circle, ${c1} 0%, transparent 70%)`;
        if (aura2) aura2.style.background = `radial-gradient(circle, ${c2} 0%, transparent 70%)`;
        if (orb2) orb2.style.background = `radial-gradient(circle, ${c2} 0%, transparent 70%)`;

        // 歌词刷新
        if (track.lyrics && track.lyrics.length > 0) {
            renderLyrics(track.lyrics);
        } else {
            lyricsWrapper.innerHTML = `<div class="lyric-empty-shimmer">正在轻点获取歌词...</div>`;
        }

        Native.fetchLyrics(track.id, track.title, track.artist, track.duration, (err, lyrics) => {
            if (!err && lyrics && lyrics.length > 0) {
                track.lyrics = lyrics;
                renderLyrics(lyrics);
            }
        });

        updateLikeStatus();
    }

    function playTrack(track, queue) {
        if (!track) return;
        if (queue && queue.length > 0) {
            state.playlistQueue = queue;
        }

        loadTrack(track);

        if (!state.historyTracks.find(t => t.id === track.id)) {
            state.historyTracks.unshift(track);
            renderTrackList(document.getElementById("recentTracksBody"), state.historyTracks);
        }

        // 调用 Android 原生层播放 (若 audioUrl 缺失或以 resolve: 开头，原生桥接将自动通过网易云检索播放完整音轨)
        const playUrl = track.audioUrl || ("resolve:" + track.title);
        Native.playAudio(playUrl, track.title, track.artist, track.album || "Spotify", track.cover);
        state.isPlaying = true;
        updatePlayPauseUI();
        Native.vibrate(15);
    }

    function togglePlay() {
        if (!state.currentTrack) {
            if (state.playlistQueue.length > 0) playTrack(state.playlistQueue[0]);
            return;
        }
        if (state.isPlaying) {
            Native.pauseAudio();
            state.isPlaying = false;
        } else {
            Native.resumeAudio();
            state.isPlaying = true;
        }
        updatePlayPauseUI();
        Native.vibrate(18);
    }

    function updatePlayPauseUI() {
        if (state.isPlaying) {
            iconPlay.style.display = "none";
            iconPause.style.display = "block";
            sheetIconPlay.style.display = "none";
            sheetIconPause.style.display = "block";
            artworkFrame.classList.remove("paused");
        } else {
            iconPlay.style.display = "block";
            iconPause.style.display = "none";
            sheetIconPlay.style.display = "block";
            sheetIconPause.style.display = "none";
            artworkFrame.classList.add("paused");
        }
    }

    // 渲染逐字歌词
    function renderLyrics(lyrics) {
        if (!lyrics || lyrics.length === 0) {
            lyricsWrapper.innerHTML = `<div class="lyric-empty-shimmer">本曲目暂无同步歌词</div>`;
            return;
        }
        lyricsWrapper.innerHTML = lyrics.map((line, idx) => `
            <div class="lyric-line-item" id="lyric-${idx}" data-time="${line.time}">
                ${line.text}
                ${line.trans ? `<span class="lyric-translation-text">${line.trans}</span>` : ""}
            </div>
        `).join("");
    }

    // 同步歌词
    function syncLyrics(currTime) {
        if (!state.currentTrack?.lyrics) return;
        const lyrics = state.currentTrack.lyrics;
        let activeIdx = -1;

        for (let i = 0; i < lyrics.length; i++) {
            if (currTime >= lyrics[i].time) {
                activeIdx = i;
            } else {
                break;
            }
        }

        if (activeIdx !== state.activeLyricIndex) {
            state.activeLyricIndex = activeIdx;
            document.querySelectorAll(".lyric-line-item").forEach(l => l.classList.remove("active"));

            if (activeIdx >= 0) {
                const activeEl = document.getElementById(`lyric-${activeIdx}`);
                if (activeEl) {
                    activeEl.classList.add("active");
                    activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }
        }
    }

    // 点赞状态更新
    function updateLikeStatus() {
        const isLiked = state.likedTrackIds.has(state.currentTrack?.id);
        const svgMini = barBtnLike.querySelector("svg");
        const svgSheet = npBtnLike.querySelector("svg");

        const updateSvg = (svg) => {
            if (isLiked) {
                svg.setAttribute("fill", "#1ed760");
                svg.setAttribute("stroke", "none");
            } else {
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "currentColor");
            }
        };

        if (svgMini) updateSvg(svgMini);
        if (svgSheet) updateSvg(svgSheet);
    }

    function toggleLike() {
        if (!state.currentTrack) return;
        const id = state.currentTrack.id;
        if (state.likedTrackIds.has(id)) {
            state.likedTrackIds.delete(id);
            state.likedTracks = state.likedTracks.filter(t => t.id !== id);
            Native.toast("已从已点赞歌曲移除");
        } else {
            state.likedTrackIds.add(id);
            state.likedTracks.unshift(state.currentTrack);
            Native.toast("已添加到已点赞歌曲");
        }
        document.getElementById("likedCountLabel").textContent = `共 ${state.likedTracks.length} 首歌曲`;
        renderTrackList(document.getElementById("likedTracksBody"), state.likedTracks);
        updateLikeStatus();
        updateSyncStatusDisplay();
        Native.vibrate(20);
    }

    // 页面路由与抽屉
    function switchPage(pageKey) {
        document.querySelectorAll(".apple-view").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".nav-tile").forEach(n => n.classList.remove("active"));
        document.querySelectorAll(".user-playlist-item").forEach(p => p.classList.remove("active"));

        const targetView = document.getElementById("view" + pageKey.charAt(0).toUpperCase() + pageKey.slice(1));
        const targetNav = document.querySelector(`.nav-tile[data-page="${pageKey}"]`);

        if (targetView) targetView.classList.add("active");
        if (targetNav) targetNav.classList.add("active");

        if (window.innerWidth <= 860) {
            appSidebar.classList.remove("open");
        }
        Native.vibrate(12);
    }

    // 全屏 Now Playing 展开/收起
    function openNowPlaying() {
        nowPlayingOverlay.classList.add("open");
        state.isNowPlayingOpen = true;
        Native.vibrate(25);
    }

    function closeNowPlaying() {
        nowPlayingOverlay.classList.remove("open");
        state.isNowPlayingOpen = false;
    }

    // 缓存读取与清除
    function refreshCacheDisplay() {
        Native.getCacheSize((err, res) => {
            const descEl = document.getElementById("settingsCacheDesc");
            if (descEl) {
                descEl.textContent = `已占用 ${res?.formatted || "36.4 MB"} 本地存储空间`;
            }
        });
    }

    // ==========================================================
    // 搜索执行引擎
    // ==========================================================
    function performSearch(query, filterType) {
        const resultsWrap = document.getElementById("searchResultsWrap");
        resultsWrap.innerHTML = `<div class="empty-state-view"><span class="empty-text">正在全网搜索 "${query}"...</span></div>`;

        if (state.accessToken) {
            Native.fetchWebApi(`search?q=${encodeURIComponent(query)}&type=track,playlist&limit=25`, state.accessToken, "GET", null, (err, res) => {
                if (!err && res && res.tracks && res.tracks.items && res.tracks.items.length > 0) {
                    const onlineTracks = res.tracks.items.map(item => ({
                        id: item.id,
                        title: item.name,
                        artist: item.artists ? item.artists.map(a => a.name).join(", ") : "未知歌手",
                        album: item.album ? item.album.name : "单曲",
                        duration: Math.round(item.duration_ms / 1000),
                        cover: item.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600",
                        aura1: "rgba(30, 215, 96, 0.55)",
                        aura2: "rgba(10, 132, 255, 0.4)",
                        audioUrl: item.preview_url || ("resolve:" + item.name)
                    }));

                    onlineTracks.forEach(registerTrack);

                    resultsWrap.innerHTML = `
                        <div class="apple-track-list-card">
                            <div class="track-items-stack" id="searchTracksBody"></div>
                        </div>
                    `;
                    renderTrackList(document.getElementById("searchTracksBody"), onlineTracks);
                    return;
                }
                fallbackLocalSearch(query);
            });
        } else {
            fallbackLocalSearch(query);
        }
    }

    function fallbackLocalSearch(query) {
        const q = query.toLowerCase();
        const allTracks = Array.from(trackRegistry.values());
        const filtered = allTracks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.album && t.album.toLowerCase().includes(q))
        );
        const resultsWrap = document.getElementById("searchResultsWrap");
        if (filtered.length === 0) {
            resultsWrap.innerHTML = `<div class="empty-state-view"><span class="empty-text">未找到相关结果，尝试登录 Spotify 检索完整曲库</span></div>`;
            return;
        }
        resultsWrap.innerHTML = `
            <div class="apple-track-list-card">
                <div class="track-items-stack" id="searchTracksBody"></div>
            </div>
        `;
        renderTrackList(document.getElementById("searchTracksBody"), filtered);
    }

    // ==========================================================
    // 全局事件绑定与代理
    // ==========================================================
    function bindEvents() {
        // 全局曲目点击事件代理 (彻底解决任何列表的歌曲无法点击的问题)
        document.addEventListener("click", (e) => {
            // 点击歌词跳转播放
            const lyricLine = e.target.closest(".lyric-line-item");
            if (lyricLine) {
                const targetTime = parseFloat(lyricLine.getAttribute("data-time"));
                if (!isNaN(targetTime)) {
                    Native.seekAudio(Math.floor(targetTime * 1000));
                    Native.vibrate(15);
                }
                return;
            }

            // 点击侧栏歌单
            const playlistItem = e.target.closest(".user-playlist-item");
            if (playlistItem) {
                const pid = playlistItem.getAttribute("data-playlist-id");
                const p = state.userPlaylists.find(x => x.id === pid);
                if (p) {
                    openPlaylist(p.id, p.name, p.cover, p.owner, p.trackCount, p.description);
                }
                return;
            }

            // 点击曲目行
            const trackRow = e.target.closest("[data-track-id]");
            if (trackRow && !e.target.closest("button") && !e.target.closest(".card-play-btn")) {
                const trackId = trackRow.getAttribute("data-track-id");
                const track = trackRegistry.get(trackId);
                if (track) {
                    playTrack(track);
                }
                return;
            }
        });

        // 播放/暂停控制
        btnPlayPause.addEventListener("click", (e) => { e.stopPropagation(); togglePlay(); });
        sheetBtnPlayPause.addEventListener("click", togglePlay);

        // 喜欢按钮
        barBtnLike.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(); });
        npBtnLike.addEventListener("click", toggleLike);

        // 切歌 (上一首 / 下一首)
        const handlePrev = () => {
            const list = state.playlistQueue;
            const idx = list.findIndex(t => t.id === state.currentTrack?.id);
            const prevIdx = (idx - 1 + list.length) % list.length;
            playTrack(list[prevIdx]);
        };

        const handleNext = () => {
            const list = state.playlistQueue;
            const idx = list.findIndex(t => t.id === state.currentTrack?.id);
            const nextIdx = (idx + 1) % list.length;
            playTrack(list[nextIdx]);
        };

        btnPrev.addEventListener("click", (e) => { e.stopPropagation(); handlePrev(); });
        sheetBtnPrev.addEventListener("click", handlePrev);

        btnNext.addEventListener("click", (e) => { e.stopPropagation(); handleNext(); });
        sheetBtnNext.addEventListener("click", handleNext);

        // 展开 Now Playing
        barCoverWrap.addEventListener("click", openNowPlaying);
        document.getElementById("btnToggleLyrics").addEventListener("click", (e) => {
            e.stopPropagation();
            openNowPlaying();
        });

        // 进度滑块交互
        scrubberTrack.addEventListener("click", (e) => {
            const rect = scrubberTrack.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (state.duration > 0) {
                const targetMs = Math.floor(pos * state.duration * 1000);
                Native.seekAudio(targetMs);
                Native.vibrate(15);
            }
        });

        // 关闭 Sheet
        btnCloseNowPlaying.addEventListener("click", closeNowPlaying);

        let touchStartY = 0;
        nowPlayingOverlay.addEventListener("touchstart", (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        nowPlayingOverlay.addEventListener("touchend", (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            if (touchEndY - touchStartY > 90) {
                closeNowPlaying();
                Native.vibrate(15);
            }
        }, { passive: true });

        // 侧边栏与导航
        document.querySelectorAll(".nav-tile").forEach(item => {
            item.addEventListener("click", () => {
                const page = item.getAttribute("data-page");
                switchPage(page);
            });
        });

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener("click", () => {
                appSidebar.classList.toggle("open");
                Native.vibrate(15);
            });
        }

        // 登录/登出与同步
        btnLogin.addEventListener("click", () => Native.login());
        userPill.addEventListener("click", () => {
            if (state.user.isGuest) Native.login(); else switchPage("settings");
        });
        document.getElementById("btnSettingsLogin").addEventListener("click", () => Native.login());
        document.getElementById("btnSettingsLogout").addEventListener("click", () => {
            Native.logout();
            Native.toast("已退出登录，恢复访客模式");
            syncSpotifyUserData(false);
            switchPage("home");
        });

        document.getElementById("btnSyncPlaylists").addEventListener("click", () => syncSpotifyUserData(true));
        document.getElementById("btnSettingsSyncNow").addEventListener("click", () => syncSpotifyUserData(true));

        // 缓存清除
        document.getElementById("btnClearCache").addEventListener("click", () => {
            Native.clearCache((err, ok) => {
                Native.toast("本地缓存已清除完毕");
                Native.vibrate(20);
                document.getElementById("settingsCacheDesc").textContent = "已占用 0 B 本地存储空间";
            });
        });

        // 播放全部与随机播放动作
        document.getElementById("btnPlayAllDaily")?.addEventListener("click", () => {
            playTrack(FEATURED_TRACKS[0], FEATURED_TRACKS);
        });
        document.getElementById("btnShuffleDaily")?.addEventListener("click", () => {
            const shuffled = [...FEATURED_TRACKS].sort(() => Math.random() - 0.5);
            playTrack(shuffled[0], shuffled);
        });

        document.getElementById("btnPlayAllLiked")?.addEventListener("click", () => {
            if (state.likedTracks.length > 0) playTrack(state.likedTracks[0], state.likedTracks);
        });
        document.getElementById("btnShuffleLiked")?.addEventListener("click", () => {
            if (state.likedTracks.length > 0) {
                const shuffled = [...state.likedTracks].sort(() => Math.random() - 0.5);
                playTrack(shuffled[0], shuffled);
            }
        });

        document.getElementById("btnPlayAllPlaylist")?.addEventListener("click", () => {
            if (state.currentViewingPlaylist?.tracks?.length > 0) {
                playTrack(state.currentViewingPlaylist.tracks[0], state.currentViewingPlaylist.tracks);
            }
        });
        document.getElementById("btnShufflePlaylist")?.addEventListener("click", () => {
            if (state.currentViewingPlaylist?.tracks?.length > 0) {
                const shuffled = [...state.currentViewingPlaylist.tracks].sort(() => Math.random() - 0.5);
                playTrack(shuffled[0], shuffled);
            }
        });

        // 搜索输入与筛选
        let searchTimer = null;
        searchInput.addEventListener("input", (e) => {
            const q = e.target.value.trim();
            clearSearchBtn.style.display = q ? "block" : "none";
            clearTimeout(searchTimer);

            if (!q) {
                switchPage("home");
                return;
            }

            switchPage("search");
            searchTimer = setTimeout(() => performSearch(q, "all"), 350);
        });

        clearSearchBtn.addEventListener("click", () => {
            searchInput.value = "";
            clearSearchBtn.style.display = "none";
            switchPage("home");
        });

        document.querySelectorAll(".chip-item").forEach(chip => {
            chip.addEventListener("click", () => {
                document.querySelectorAll(".chip-item").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                const filter = chip.getAttribute("data-filter");
                if (searchInput.value.trim()) {
                    performSearch(searchInput.value.trim(), filter);
                }
            });
        });

        // 前进/后退
        document.getElementById("btnBack")?.addEventListener("click", () => {
            switchPage("home");
        });
        document.getElementById("btnForward")?.addEventListener("click", () => {
            switchPage("daily");
        });
    }

    // ==========================================================
    // 原生层事件接收回调 (Window Callbacks)
    // ==========================================================
    window.onNativePlaybackStateChanged = function (isPlaying, currentPosMs, durationMs) {
        state.isPlaying = isPlaying;
        state.currentTime = currentPosMs / 1000;
        if (durationMs > 0) state.duration = durationMs / 1000;

        updatePlayPauseUI();

        if (state.duration > 0) {
            const percent = Math.min(100, (state.currentTime / state.duration) * 100);
            miniProgressFill.style.width = percent + "%";
            scrubberFill.style.width = percent + "%";
            timeCurrent.textContent = formatTime(state.currentTime);
            timeDuration.textContent = formatTime(state.duration);
        }

        syncLyrics(state.currentTime);
    };

    window.onNativeTrackEnded = function () {
        btnNext.click();
    };

    window.onNativeNextRequested = function () {
        btnNext.click();
    };

    window.onNativePrevRequested = function () {
        btnPrev.click();
    };

    window.onNativeLoginSuccess = function (success) {
        if (success) {
            Native.toast("Spotify 登录成功！正在同步歌单与收藏...");
        }
        syncSpotifyUserData(true);
    };

    window.handleAndroidBack = function () {
        if (state.isNowPlayingOpen) {
            closeNowPlaying();
            return true;
        }
        if (appSidebar.classList.contains("open")) {
            appSidebar.classList.remove("open");
            return true;
        }
        return false;
    };

    // 启动引擎
    initUI();
    bindEvents();
})();
