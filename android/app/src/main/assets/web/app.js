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
        historyTracks: [],
        playlistQueue: [...FEATURED_TRACKS],
        user: {
            isLoggedIn: false,
            isGuest: true,
            name: "访客模式",
            avatar: "访"
        },
        accessToken: null
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

    // 原生交互桥接
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
                window._cbToken = function (err, res) {
                    delete window._cbToken;
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.fetchAccessToken("window._cbToken");
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
        playAudio(url, title, artist, album, coverUrl) {
            if (window.AndroidBridge && window.AndroidBridge.playTrack) {
                window.AndroidBridge.playTrack(url, title, artist, album, coverUrl);
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

    // 时间格式化 (mm:ss)
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    // 问候语
    function updateGreeting() {
        const hour = new Date().getHours();
        let greeting = "晚上好";
        if (hour >= 5 && hour < 12) greeting = "早上好";
        else if (hour >= 12 && hour < 18) greeting = "下午好";
        const el = document.getElementById("homeGreeting");
        if (el) el.textContent = greeting;
    }

    // 初始化渲染
    function initUI() {
        updateGreeting();

        // 快捷精选卡片
        const quickGrid = document.getElementById("quickGrid");
        quickGrid.innerHTML = FEATURED_TRACKS.map(t => `
            <div class="quick-card" data-track-id="${t.id}">
                <img src="${t.cover}" class="quick-thumb" alt="${t.title}">
                <div class="quick-title">${t.title}</div>
            </div>
        `).join("");

        // 每日精选横向橱窗
        const dailyMixes = document.getElementById("dailyMixes");
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

        // 热门单曲榜
        renderTrackList(document.getElementById("homeTopTracksBody"), FEATURED_TRACKS);

        // 排行榜
        const chartsGrid = document.getElementById("chartsGrid");
        chartsGrid.innerHTML = `
            <div class="quick-card">
                <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80" class="quick-thumb" alt="Top 50">
                <div class="quick-title">全球热门 50 强</div>
            </div>
            <div class="quick-card">
                <img src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&q=80" class="quick-thumb" alt="Viral 50">
                <div class="quick-title">流行热搜榜</div>
            </div>
        `;

        // 浏览全部分类
        const browseGrid = document.getElementById("browseGrid");
        const categories = [
            { name: "流行", color: "#8d67ab" },
            { name: "摇滚", color: "#e91429" },
            { name: "嘻哈", color: "#bc5900" },
            { name: "电子/舞曲", color: "#0d73ec" },
            { name: "独立音乐", color: "#509bf5" },
            { name: "专注与放松", color: "#1e3264" }
        ];
        browseGrid.innerHTML = categories.map(c => `
            <div style="background-color: ${c.color}; height: 96px; border-radius: 12px; padding: 14px; font-weight: 700; font-size: 16px; color: #fff; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.3);">
                ${c.name}
            </div>
        `).join("");

        // 每日推荐列表
        renderTrackList(document.getElementById("dailyTracksBody"), FEATURED_TRACKS);

        bindTrackClickListeners();
        loadTrack(FEATURED_TRACKS[0]);
        refreshAccountState();
    }

    function renderTrackList(container, tracks) {
        if (!container) return;
        container.innerHTML = tracks.map((t, idx) => `
            <div class="apple-track-row" data-track-id="${t.id}">
                <span class="track-index-num">${idx + 1}</span>
                <img src="${t.cover}" class="track-artwork-thumb" alt="${t.title}">
                <div class="track-info-col">
                    <span class="track-name-text">${t.title}</span>
                    <span class="track-artist-text">${t.artist}</span>
                </div>
                <span class="track-album-text">${t.album || ""}</span>
                <span class="track-duration-text">${formatTime(t.duration)}</span>
            </div>
        `).join("");
    }

    function bindTrackClickListeners() {
        document.querySelectorAll("[data-track-id]").forEach(el => {
            el.addEventListener("click", () => {
                const trackId = el.getAttribute("data-track-id");
                const track = state.playlistQueue.find(t => t.id === trackId) || FEATURED_TRACKS.find(t => t.id === trackId);
                if (track) playTrack(track);
            });
        });
    }

    // 刷新账户与 Token
    function refreshAccountState() {
        const status = Native.getLoginStatus();
        if (status.isLoggedIn) {
            state.user.isLoggedIn = true;
            state.user.isGuest = false;
            state.user.name = "Spotify 订阅会员";
            state.user.avatar = "S";
            btnLogin.style.display = "none";
            document.getElementById("settingsAccountName").textContent = "已登录 (Spotify 账号)";
            document.getElementById("settingsAccountDesc").textContent = "已激活会员高级功能，支持自动续期与云端歌单同步";
            document.getElementById("btnSettingsLogin").style.display = "none";
            document.getElementById("btnSettingsLogout").style.display = "inline-block";
        } else {
            state.user.isLoggedIn = false;
            state.user.isGuest = true;
            state.user.name = "访客模式";
            state.user.avatar = "访";
            btnLogin.style.display = "block";
            document.getElementById("settingsAccountName").textContent = "未登录 (访客身份)";
            document.getElementById("settingsAccountDesc").textContent = "登录后可同步你的 Spotify 歌单与已点赞音乐";
            document.getElementById("btnSettingsLogin").style.display = "inline-block";
            document.getElementById("btnSettingsLogout").style.display = "none";
        }

        sidebarAvatar.textContent = state.user.avatar;
        sidebarUserName.textContent = state.user.name;
        sidebarUserSub.textContent = state.user.isGuest ? "点击登录 Spotify" : "账号在线";

        Native.fetchToken((err, res) => {
            if (!err && res && res.accessToken) {
                state.accessToken = res.accessToken;
            }
        });
    }

    // 载入歌曲元数据
    function loadTrack(track) {
        state.currentTrack = track;
        barTrackTitle.textContent = track.title;
        barTrackArtist.textContent = track.artist;
        barTrackCover.src = track.cover;

        npSongName.textContent = track.title;
        npArtistName.textContent = track.artist;
        npLargeCover.src = track.cover;
        timeDuration.textContent = formatTime(track.duration);

        // 动态环境流光着色 (Dynamic Fluid Aura Coloring)
        if (track.aura1) {
            aura1.style.background = `radial-gradient(circle, ${track.aura1} 0%, transparent 70%)`;
            orb1.style.background = `radial-gradient(circle, ${track.aura1} 0%, transparent 70%)`;
        }
        if (track.aura2) {
            aura2.style.background = `radial-gradient(circle, ${track.aura2} 0%, transparent 70%)`;
            orb2.style.background = `radial-gradient(circle, ${track.aura2} 0%, transparent 70%)`;
        }

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

    // 播放指定歌曲
    function playTrack(track) {
        if (state.currentTrack?.id !== track.id) {
            loadTrack(track);
        }

        if (!state.historyTracks.find(t => t.id === track.id)) {
            state.historyTracks.unshift(track);
            renderTrackList(document.getElementById("recentTracksBody"), state.historyTracks);
        }

        Native.playAudio(track.audioUrl, track.title, track.artist, track.album || "Spotify", track.cover);
        state.isPlaying = true;
        updatePlayPauseUI();
        Native.vibrate(15);
    }

    // 切换播放/暂停
    function togglePlay() {
        if (!state.currentTrack) return;
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

    // 渲染 Apple Music 呼吸感逐字歌词
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

        document.querySelectorAll(".lyric-line-item").forEach(el => {
            el.addEventListener("click", () => {
                const targetTime = parseFloat(el.getAttribute("data-time"));
                if (!isNaN(targetTime)) {
                    Native.seekAudio(Math.floor(targetTime * 1000));
                    Native.vibrate(15);
                }
            });
        });
    }

    // 同步高亮与平滑居中滚动
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

    // 喜欢状态更新
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

        const likedTracks = state.playlistQueue.filter(t => state.likedTrackIds.has(t.id));
        document.getElementById("likedCountLabel").textContent = `共 ${likedTracks.length} 首歌曲`;
        renderTrackList(document.getElementById("likedTracksBody"), likedTracks);
    }

    function toggleLike() {
        if (!state.currentTrack) return;
        const id = state.currentTrack.id;
        if (state.likedTrackIds.has(id)) {
            state.likedTrackIds.delete(id);
            Native.toast("已从已点赞歌曲移除");
        } else {
            state.likedTrackIds.add(id);
            Native.toast("已添加到已点赞歌曲");
        }
        updateLikeStatus();
        Native.vibrate(20);
    }

    // 全屏 Now Playing Sheet
    function openNowPlaying() {
        nowPlayingOverlay.classList.add("open");
        state.isNowPlayingOpen = true;
        Native.vibrate(25);
    }

    function closeNowPlaying() {
        nowPlayingOverlay.classList.remove("open");
        state.isNowPlayingOpen = false;
    }

    // 页面路由切换
    function switchPage(pageKey) {
        document.querySelectorAll(".apple-view").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".nav-tile").forEach(n => n.classList.remove("active"));

        const targetView = document.getElementById("view" + pageKey.charAt(0).toUpperCase() + pageKey.slice(1));
        const targetNav = document.querySelector(`.nav-tile[data-page="${pageKey}"]`);

        if (targetView) targetView.classList.add("active");
        if (targetNav) targetNav.classList.add("active");

        if (window.innerWidth <= 860) {
            appSidebar.classList.remove("open");
        }
    }

    // 绑定交互事件
    function bindEvents() {
        btnPlayPause.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlay();
        });
        sheetBtnPlayPause.addEventListener("click", togglePlay);

        barBtnLike.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleLike();
        });
        npBtnLike.addEventListener("click", toggleLike);

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

        // 进度滑块点击/拖拽
        scrubberTrack.addEventListener("click", (e) => {
            const rect = scrubberTrack.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (state.duration > 0) {
                const targetMs = Math.floor(pos * state.duration * 1000);
                Native.seekAudio(targetMs);
                Native.vibrate(15);
            }
        });

        // 关闭 Sheet (点击把手或下滑)
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

        // 侧边栏与移动端抽屉
        document.querySelectorAll(".nav-tile").forEach(item => {
            item.addEventListener("click", () => {
                const page = item.getAttribute("data-page");
                switchPage(page);
                Native.vibrate(12);
            });
        });

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener("click", () => {
                appSidebar.classList.toggle("open");
                Native.vibrate(15);
            });
        }

        // 登录/登出
        btnLogin.addEventListener("click", () => Native.login());
        userPill.addEventListener("click", () => {
            if (state.user.isGuest) Native.login(); else switchPage("settings");
        });
        document.getElementById("btnSettingsLogin").addEventListener("click", () => Native.login());
        document.getElementById("btnSettingsLogout").addEventListener("click", () => Native.logout());

        document.getElementById("btnClearCache").addEventListener("click", () => {
            Native.toast("已清除本地缓存");
            Native.vibrate(15);
        });

        // 搜索
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
            searchTimer = setTimeout(() => performSearch(q), 350);
        });

        clearSearchBtn.addEventListener("click", () => {
            searchInput.value = "";
            clearSearchBtn.style.display = "none";
            switchPage("home");
        });
    }

    function performSearch(query) {
        const resultsWrap = document.getElementById("searchResultsWrap");
        resultsWrap.innerHTML = `<div class="empty-state-view"><span class="empty-text">正在搜索 "${query}"...</span></div>`;

        if (state.accessToken) {
            Native.fetchWebApi(`search?q=${encodeURIComponent(query)}&type=track&limit=15`, state.accessToken, "GET", null, (err, res) => {
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
                        audioUrl: item.preview_url || "https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3"
                    }));

                    onlineTracks.forEach(t => {
                        if (!state.playlistQueue.find(q => q.id === t.id)) {
                            state.playlistQueue.push(t);
                        }
                    });

                    renderSearchResults(onlineTracks);
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
        const filtered = state.playlistQueue.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.album && t.album.toLowerCase().includes(q))
        );
        renderSearchResults(filtered);
    }

    function renderSearchResults(tracks) {
        const resultsWrap = document.getElementById("searchResultsWrap");
        if (tracks.length === 0) {
            resultsWrap.innerHTML = `<div class="empty-state-view"><span class="empty-text">未找到相关结果</span></div>`;
            return;
        }

        resultsWrap.innerHTML = `
            <div class="apple-track-list-card">
                <div class="track-items-stack" id="searchTracksBody"></div>
            </div>
        `;
        renderTrackList(document.getElementById("searchTracksBody"), tracks);
        bindTrackClickListeners();
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
            Native.toast("Spotify 登录成功！正在同步账户数据...");
        }
        refreshAccountState();
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
