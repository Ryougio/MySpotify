/**
 * MySpotify Desktop UI Engine for Android
 * State Machine, Audio Playback, Synced Lyrics & Android Bridge
 */

(function () {
    // 默认高保真精选曲库 (包含高分辨率封面、真实可播放音频流与时间轴歌词)
    const FEATURED_TRACKS = [
        {
            id: "sp-1",
            title: "Starboy",
            artist: "The Weeknd, Daft Punk",
            album: "Starboy",
            duration: 230,
            cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80",
            backdropColor: "rgba(225, 45, 57, 0.4)",
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
            cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80",
            backdropColor: "rgba(180, 50, 20, 0.4)",
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
            cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80",
            backdropColor: "rgba(40, 120, 220, 0.4)",
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
        isMuted: false,
        shuffle: false,
        repeat: false,
        isNowPlayingOpen: false,
        activeLyricIndex: -1,
        likedTrackIds: new Set(["sp-1"]),
        history: ["home"]
    };

    // DOM 元素引用
    const audio = document.getElementById("audioPlayer");
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
    const btnShuffle = document.getElementById("btnShuffle");
    const btnRepeat = document.getElementById("btnRepeat");

    const scrubberTrack = document.getElementById("scrubberTrack");
    const scrubberFill = document.getElementById("scrubberFill");
    const scrubberThumb = document.getElementById("scrubberThumb");
    const timeCurrent = document.getElementById("timeCurrent");
    const timeDuration = document.getElementById("timeDuration");

    const btnToggleLyrics = document.getElementById("btnToggleLyrics");
    const btnExpandNowPlaying = document.getElementById("btnExpandNowPlaying");
    const nowPlayingOverlay = document.getElementById("nowPlayingOverlay");
    const btnCloseNowPlaying = document.getElementById("btnCloseNowPlaying");
    const dynamicBackdrop = document.getElementById("dynamicBackdrop");
    const npLargeCover = document.getElementById("npLargeCover");
    const npSongName = document.getElementById("npSongName");
    const npArtistName = document.getElementById("npArtistName");
    const lyricsContainer = document.getElementById("lyricsContainer");
    const lyricsWrapper = document.getElementById("lyricsWrapper");

    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    const appSidebar = document.getElementById("appSidebar");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");

    // Android 原生交互桥接
    function callNative(action, payload) {
        if (window.AndroidBridge) {
            try {
                if (action === "updateNotification") {
                    window.AndroidBridge.updateMediaNotification(
                        payload.title,
                        payload.artist,
                        payload.coverUrl,
                        payload.isPlaying
                    );
                } else if (action === "vibrate") {
                    window.AndroidBridge.vibrate(payload || 20);
                } else if (action === "toast") {
                    window.AndroidBridge.showToast(payload);
                }
            } catch (err) {
                console.warn("AndroidBridge call failed:", err);
            }
        }
    }

    // 时间格式化 (mm:ss)
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    // 初始化渲染主界面数据
    function initUI() {
        // 渲染快捷网格
        const quickGrid = document.getElementById("quickGrid");
        quickGrid.innerHTML = FEATURED_TRACKS.map(t => `
            <div class="quick-card" data-track-id="${t.id}">
                <img src="${t.cover}" class="quick-thumb" alt="${t.title}">
                <div class="quick-title">${t.title}</div>
            </div>
        `).join("");

        // 渲染每日推荐轮播
        const dailyMixes = document.getElementById("dailyMixes");
        dailyMixes.innerHTML = FEATURED_TRACKS.map(t => `
            <div class="media-card" data-track-id="${t.id}">
                <div class="media-card-img-wrap">
                    <img src="${t.cover}" class="media-card-img" alt="${t.title}">
                    <div class="card-play-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.6v14.8c0 .8.9 1.3 1.6.9l12-7.4c.6-.4.6-1.3 0-1.7l-12-7.4C7.9 3.3 7 3.8 7 4.6z"/></svg>
                    </div>
                </div>
                <div class="media-card-title">${t.title}</div>
                <div class="media-card-desc">${t.artist}</div>
            </div>
        `).join("");

        // 渲染排行榜表格
        const homeTracksBody = document.getElementById("homeTopTracksBody");
        homeTracksBody.innerHTML = FEATURED_TRACKS.map((t, idx) => `
            <tr data-track-id="${t.id}">
                <td style="color: var(--text-muted);">${idx + 1}</td>
                <td>
                    <div class="track-row-title-box">
                        <img src="${t.cover}" class="track-row-cover" alt="">
                        <div class="track-row-names">
                            <span>${t.title}</span>
                            <span class="track-row-artist">${t.artist}</span>
                        </div>
                    </div>
                </td>
                <td style="color: var(--text-muted);">${t.album}</td>
                <td style="text-align: right; color: var(--text-muted);">${formatTime(t.duration)}</td>
            </tr>
        `).join("");

        // 绑定卡片与表格点击播放事件
        document.querySelectorAll("[data-track-id]").forEach(el => {
            el.addEventListener("click", () => {
                const trackId = el.getAttribute("data-track-id");
                const track = FEATURED_TRACKS.find(t => t.id === trackId);
                if (track) playTrack(track);
            });
        });

        // 默认载入第一首歌
        loadTrack(FEATURED_TRACKS[0]);
    }

    // 载入歌曲元数据
    function loadTrack(track) {
        state.currentTrack = track;
        barTrackTitle.textContent = track.title;
        barTrackArtist.textContent = track.artist;
        barTrackCover.src = track.cover;
        timeDuration.textContent = formatTime(track.duration);

        npSongName.textContent = track.title;
        npArtistName.textContent = track.artist;
        npLargeCover.src = track.cover;

        // 动态毛玻璃氛围色更新
        if (track.backdropColor) {
            dynamicBackdrop.style.background = `radial-gradient(circle at 35% 45%, ${track.backdropColor} 0%, rgba(20, 20, 22, 0.96) 75%)`;
        }

        renderLyrics(track.lyrics);
        updateLikeStatus();
        audio.src = track.audioUrl;
    }

    // 播放指定歌曲
    function playTrack(track) {
        if (state.currentTrack?.id !== track.id) {
            loadTrack(track);
        }
        audio.play().then(() => {
            state.isPlaying = true;
            updatePlayPauseButton();
            callNative("updateNotification", {
                title: track.title,
                artist: track.artist,
                coverUrl: track.cover,
                isPlaying: true
            });
            callNative("vibrate", 15);
        }).catch(e => {
            console.warn("Autoplay error:", e);
        });
    }

    // 切换播放/暂停
    function togglePlay() {
        if (!state.currentTrack) return;
        if (state.isPlaying) {
            audio.pause();
            state.isPlaying = false;
        } else {
            audio.play();
            state.isPlaying = true;
        }
        updatePlayPauseButton();
        callNative("updateNotification", {
            title: state.currentTrack.title,
            artist: state.currentTrack.artist,
            coverUrl: state.currentTrack.cover,
            isPlaying: state.isPlaying
        });
        callNative("vibrate", 20);
    }

    function updatePlayPauseButton() {
        if (state.isPlaying) {
            iconPlay.style.display = "none";
            iconPause.style.display = "block";
        } else {
            iconPlay.style.display = "block";
            iconPause.style.display = "none";
        }
    }

    // 渲染歌词列表
    function renderLyrics(lyrics) {
        if (!lyrics || lyrics.length === 0) {
            lyricsWrapper.innerHTML = `<div class="lyric-line-placeholder">本歌曲暂无同步歌词</div>`;
            return;
        }
        lyricsWrapper.innerHTML = lyrics.map((line, idx) => `
            <div class="lyric-line" id="lyric-${idx}" data-time="${line.time}">
                ${line.text}
                ${line.trans ? `<span class="lyric-trans">${line.trans}</span>` : ""}
            </div>
        `).join("");

        // 歌词点击跳转播放时间点
        document.querySelectorAll(".lyric-line").forEach((el, idx) => {
            el.addEventListener("click", () => {
                const targetTime = parseFloat(el.getAttribute("data-time"));
                if (!isNaN(targetTime)) {
                    audio.currentTime = targetTime;
                    if (!state.isPlaying) togglePlay();
                    callNative("vibrate", 15);
                }
            });
        });
    }

    // 滚动并高亮当前时间对应歌词
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
            document.querySelectorAll(".lyric-line").forEach(l => l.classList.remove("active"));
            
            if (activeIdx >= 0) {
                const activeEl = document.getElementById(`lyric-${activeIdx}`);
                if (activeEl) {
                    activeEl.classList.add("active");
                    // 平滑滚动将高亮行居中
                    activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }
        }
    }

    // 切换喜欢状态
    function updateLikeStatus() {
        const isLiked = state.likedTrackIds.has(state.currentTrack?.id);
        const svg = barBtnLike.querySelector("svg");
        if (isLiked) {
            svg.setAttribute("fill", "#1ed760");
            svg.setAttribute("stroke", "none");
        } else {
            svg.setAttribute("fill", "none");
            svg.setAttribute("stroke", "currentColor");
        }
    }

    function toggleLike() {
        if (!state.currentTrack) return;
        const id = state.currentTrack.id;
        if (state.likedTrackIds.has(id)) {
            state.likedTrackIds.delete(id);
            callNative("toast", "已从你的音乐库移除");
        } else {
            state.likedTrackIds.add(id);
            callNative("toast", "已添加到你的音乐库");
        }
        updateLikeStatus();
        callNative("vibrate", 20);
    }

    // 全屏正在播放视图切换
    function openNowPlaying() {
        nowPlayingOverlay.classList.add("open");
        state.isNowPlayingOpen = true;
        callNative("vibrate", 25);
    }

    function closeNowPlaying() {
        nowPlayingOverlay.classList.remove("open");
        state.isNowPlayingOpen = false;
    }

    // 页面路由切换
    function switchPage(pageKey) {
        document.querySelectorAll(".view-page").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

        const targetView = document.getElementById("view" + pageKey.charAt(0).toUpperCase() + pageKey.slice(1));
        const targetNav = document.querySelector(`.nav-item[data-page="${pageKey}"]`);

        if (targetView) targetView.classList.add("active");
        if (targetNav) targetNav.classList.add("active");

        if (window.innerWidth <= 820) {
            appSidebar.classList.remove("open");
        }
    }

    // 注册事件监听
    function bindEvents() {
        btnPlayPause.addEventListener("click", togglePlay);
        barBtnLike.addEventListener("click", toggleLike);

        btnPrev.addEventListener("click", () => {
            const idx = FEATURED_TRACKS.findIndex(t => t.id === state.currentTrack?.id);
            const prevIdx = (idx - 1 + FEATURED_TRACKS.length) % FEATURED_TRACKS.length;
            playTrack(FEATURED_TRACKS[prevIdx]);
        });

        btnNext.addEventListener("click", () => {
            const idx = FEATURED_TRACKS.findIndex(t => t.id === state.currentTrack?.id);
            const nextIdx = (idx + 1) % FEATURED_TRACKS.length;
            playTrack(FEATURED_TRACKS[nextIdx]);
        });

        // 进度拖动
        scrubberTrack.addEventListener("click", (e) => {
            const rect = scrubberTrack.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (audio.duration) {
                audio.currentTime = pos * audio.duration;
            }
        });

        // 音频播放更新
        audio.addEventListener("timeupdate", () => {
            state.currentTime = audio.currentTime;
            state.duration = audio.duration || state.currentTrack?.duration || 0;
            const percent = (state.currentTime / state.duration) * 100;
            scrubberFill.style.width = percent + "%";
            timeCurrent.textContent = formatTime(state.currentTime);
            syncLyrics(state.currentTime);
        });

        audio.addEventListener("ended", () => {
            btnNext.click();
        });

        // 展开与收起正在播放
        barCoverWrap.addEventListener("click", openNowPlaying);
        btnExpandNowPlaying.addEventListener("click", openNowPlaying);
        btnToggleLyrics.addEventListener("click", openNowPlaying);
        btnCloseNowPlaying.addEventListener("click", closeNowPlaying);

        // 侧边栏导航点击
        document.querySelectorAll(".nav-item").forEach(item => {
            item.addEventListener("click", () => {
                const page = item.getAttribute("data-page");
                switchPage(page);
                callNative("vibrate", 15);
            });
        });

        // 移动端菜单按钮
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener("click", () => {
                appSidebar.classList.toggle("open");
            });
        }

        // 搜索输入过滤
        searchInput.addEventListener("input", (e) => {
            const q = e.target.value.trim().toLowerCase();
            clearSearchBtn.style.display = q ? "block" : "none";
            if (q) {
                switchPage("search");
                const filtered = FEATURED_TRACKS.filter(t => 
                    t.title.toLowerCase().includes(q) || 
                    t.artist.toLowerCase().includes(q) || 
                    t.album.toLowerCase().includes(q)
                );
                const resultsWrap = document.getElementById("searchResultsWrap");
                if (filtered.length > 0) {
                    resultsWrap.innerHTML = `
                        <div class="track-table-wrap">
                            <table class="track-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>标题</th>
                                        <th>专辑</th>
                                        <th style="text-align: right;">时长</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filtered.map((t, idx) => `
                                        <tr data-track-id="${t.id}">
                                            <td>${idx + 1}</td>
                                            <td>
                                                <div class="track-row-title-box">
                                                    <img src="${t.cover}" class="track-row-cover" alt="">
                                                    <div class="track-row-names">
                                                        <span>${t.title}</span>
                                                        <span class="track-row-artist">${t.artist}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>${t.album}</td>
                                            <td style="text-align: right;">${formatTime(t.duration)}</td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    `;
                    resultsWrap.querySelectorAll("tr[data-track-id]").forEach(r => {
                        r.addEventListener("click", () => {
                            const id = r.getAttribute("data-track-id");
                            const trk = FEATURED_TRACKS.find(t => t.id === id);
                            if (trk) playTrack(trk);
                        });
                    });
                } else {
                    resultsWrap.innerHTML = `<div class="empty-state">未找到包含 "${q}" 的单曲或艺人</div>`;
                }
            }
        });

        clearSearchBtn.addEventListener("click", () => {
            searchInput.value = "";
            clearSearchBtn.style.display = "none";
            switchPage("home");
        });
    }

    // Android 系统返回键拦截
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
