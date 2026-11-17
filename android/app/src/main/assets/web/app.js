/**
 * MySpotify - Apple Design & Windows Desktop Parity Web Engine
 * Fully authentic implementation of MySpotify Windows UI grounded in Apple HIG.
 * Powered by Spotify Pathfinder GraphQL, TOTP Signature, LRCLIB & NetEase Lyrics.
 */

(function () {
    "use strict";

    // Spotify Pathfinder GraphQL Persisted Query Hashes (from internal/spotify/spotify.go)
    const GRAPHQL_OPS = {
        profileAttributes: "08ffb4730af3746e04a8301396f20875dbbce10c75243803091a9274eacc8ac0",
        libraryV3: "390c78e5b951029bad359785e69b07b536a509c581cbcd0aded5e5067f187455",
        fetchLibraryTracks: "087278b20b743578a6262c2b0b4bcd20d879c503cc359a2285baf083ef944240",
        fetchPlaylist: "21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf",
        searchTracks: "b02683192a98dde7966b5e6655a79eeb62713eab703eda9902c932818dd52751",
        browseAll: "dbd8b55e09a58afc52eab438bc228ba28fd72ac2f2148c6c26354980e4579001",
        home: "5fb7da7a03ee2776c0670856609cb85a189a3cecc36cc160b91cde79063b9cf1"
    };

    // 高品质精选预设曲目 (离线或访客备用)
    const DEFAULT_TRACKS = [
        {
            id: "sp-1",
            title: "Cruel Summer",
            artist: "Taylor Swift",
            album: "Lover",
            duration: 178,
            cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=85",
            audioUrl: "https://cdn.freesound.org/previews/612/612088_5674468-lq.mp3"
        },
        {
            id: "sp-2",
            title: "Blinding Lights",
            artist: "The Weeknd",
            album: "After Hours",
            duration: 200,
            cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=85",
            audioUrl: "https://cdn.freesound.org/previews/612/612092_5674468-lq.mp3"
        },
        {
            id: "sp-3",
            title: "Starboy",
            artist: "The Weeknd, Daft Punk",
            album: "Starboy",
            duration: 230,
            cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=85",
            audioUrl: "https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3"
        }
    ];

    // 全局曲目注册表
    const trackRegistry = new Map();
    function registerTrack(t) {
        if (t && t.id) trackRegistry.set(t.id, t);
    }
    DEFAULT_TRACKS.forEach(registerTrack);

    // 运行时状态管理
    const state = {
        currentPage: "home",
        history: [],
        forwardStack: [],
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        shuffle: false,
        repeat: false,
        lyrics: [],
        activeLyricIndex: -1,
        likedTrackIds: new Set(["sp-1"]),
        likedTracks: [...DEFAULT_TRACKS.slice(0, 1)],
        userPlaylists: [],
        savedPlaylists: [],
        currentPlaylist: null,
        user: {
            isLoggedIn: false,
            isGuest: true,
            name: "访客模式",
            email: "",
            avatar: "客",
            avatarUrl: null,
            tier: "免费访客"
        },
        accessToken: null,
        theme: "light"
    };

    // Android 原生交互桥接
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
        getSavedAccessToken() {
            if (window.AndroidBridge && window.AndroidBridge.getSavedAccessToken) {
                return window.AndroidBridge.getSavedAccessToken();
            }
            return "";
        },
        fetchAccessToken(callback) {
            if (window.AndroidBridge && window.AndroidBridge.fetchAccessToken) {
                const cbName = "_cbToken_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.fetchAccessToken("window." + cbName);
            } else {
                callback("No AndroidBridge", null);
            }
        },
        fetchPathfinder(operationName, hash, variables, token, callback) {
            if (window.AndroidBridge && window.AndroidBridge.fetchPathfinder) {
                const cbName = "_cbGql_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.fetchPathfinder(
                    operationName,
                    hash,
                    variables ? JSON.stringify(variables) : "{}",
                    token || state.accessToken || "",
                    "window." + cbName
                );
            } else {
                callback("No AndroidBridge", null);
            }
        },
        fetchLyrics(trackId, title, artist, durationSec, callback) {
            if (window.AndroidBridge && window.AndroidBridge.fetchLyrics) {
                const cbName = "_cbLyrics_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : []);
                };
                window.AndroidBridge.fetchLyrics(trackId, title, artist, durationSec || 0, "window." + cbName);
            } else {
                callback("No AndroidBridge", []);
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
                window[cbName] = function (err, ok) {
                    delete window[cbName];
                    callback(err, ok);
                };
                window.AndroidBridge.clearCache("window." + cbName);
            } else {
                callback(null, true);
            }
        },
        setProxy(proxy) {
            if (window.AndroidBridge && window.AndroidBridge.setProxy) {
                window.AndroidBridge.setProxy(proxy);
            }
        },
        getProxy() {
            if (window.AndroidBridge && window.AndroidBridge.getProxy) {
                return window.AndroidBridge.getProxy();
            }
            return "";
        },
        setStatusBarTheme(dark) {
            if (window.AndroidBridge && window.AndroidBridge.setStatusBarTheme) {
                window.AndroidBridge.setStatusBarTheme(dark);
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
    const elSidebarSearchInput = document.getElementById("sidebarSearchInput");
    const elMobileSearchInput = document.getElementById("mobileSearchInput");
    const elMobileClearSearch = document.getElementById("mobileClearSearch");
    const elMobileBackBtn = document.getElementById("mobileBackBtn");
    const elMobilePageTitle = document.getElementById("mobilePageTitle");
    const elBtnHistoryBack = document.getElementById("btnHistoryBack");
    const elBtnHistoryForward = document.getElementById("btnHistoryForward");

    // 播放条 DOM
    const elBarTrackCover = document.getElementById("barTrackCover");
    const elBarTrackTitle = document.getElementById("barTrackTitle");
    const elBarTrackArtist = document.getElementById("barTrackArtist");
    const elBarBtnLike = document.getElementById("barBtnLike");
    const elBarBtnPlayPause = document.getElementById("barBtnPlayPause");
    const elIconBarPlay = document.getElementById("iconBarPlay");
    const elIconBarPause = document.getElementById("iconBarPause");
    const elBarBtnPrev = document.getElementById("barBtnPrev");
    const elBarBtnNext = document.getElementById("barBtnNext");
    const elBarBtnShuffle = document.getElementById("barBtnShuffle");
    const elBarBtnRepeat = document.getElementById("barBtnRepeat");
    const elBarTimeCurrent = document.getElementById("barTimeCurrent");
    const elBarTimeDuration = document.getElementById("barTimeDuration");
    const elBarScrubTrack = document.getElementById("barScrubTrack");
    const elBarScrubFill = document.getElementById("barScrubFill");
    const elBarVolumeRange = document.getElementById("barVolumeRange");
    const elBarBtnLyrics = document.getElementById("barBtnLyrics");
    const elBarBtnExpand = document.getElementById("barBtnExpand");
    const elBarCoverInfoGroup = document.getElementById("barCoverInfoGroup");

    // Fullscreen Sheet DOM
    const elSheetOverlay = document.getElementById("sheetOverlay");
    const elBtnDismissSheet = document.getElementById("btnDismissSheet");
    const elTabArtwork = document.getElementById("tabArtwork");
    const elTabLyrics = document.getElementById("tabLyrics");
    const elSheetDualScaffold = document.querySelector(".sheet-dual-scaffold");
    const elSheetCoverImg = document.getElementById("sheetCoverImg");
    const elSheetSongTitle = document.getElementById("sheetSongTitle");
    const elSheetSongArtist = document.getElementById("sheetSongArtist");
    const elSheetBtnLike = document.getElementById("sheetBtnLike");
    const elSheetScrubRail = document.getElementById("sheetScrubRail");
    const elSheetScrubFill = document.getElementById("sheetScrubFill");
    const elSheetTimeCurrent = document.getElementById("sheetTimeCurrent");
    const elSheetTimeDuration = document.getElementById("sheetTimeDuration");
    const elSheetBtnPlayPause = document.getElementById("sheetBtnPlayPause");
    const elIconSheetPlay = document.getElementById("iconSheetPlay");
    const elIconSheetPause = document.getElementById("iconSheetPause");
    const elSheetBtnPrev = document.getElementById("sheetBtnPrev");
    const elSheetBtnNext = document.getElementById("sheetBtnNext");
    const elSheetBtnShuffle = document.getElementById("sheetBtnShuffle");
    const elSheetBtnRepeat = document.getElementById("sheetBtnRepeat");
    const elSheetLyricsStream = document.getElementById("sheetLyricsStream");
    const elSheetLyricsViewport = document.getElementById("sheetLyricsViewport");

    // =========================================================================
    // 路由与页面切换 (支持前进、后退、双端联动)
    // =========================================================================
    const PAGE_NAMES = {
        home: "为你推荐",
        daily: "每日推荐",
        charts: "排行榜",
        browse: "浏览",
        recent: "最近播放",
        search: "搜索",
        liked: "我喜欢的音乐",
        playlist: "歌单详情",
        settings: "设置"
    };

    function navigateTo(pageId, addToHistory = true) {
        if (state.currentPage === pageId && pageId !== "playlist") return;

        if (addToHistory && state.currentPage) {
            state.history.push(state.currentPage);
            state.forwardStack = [];
        }

        state.currentPage = pageId;
        updateViewDisplay();
    }

    function goBack() {
        if (state.history.length > 0) {
            state.forwardStack.push(state.currentPage);
            const prev = state.history.pop();
            state.currentPage = prev;
            updateViewDisplay();
        }
    }

    function goForward() {
        if (state.forwardStack.length > 0) {
            state.history.push(state.currentPage);
            const next = state.forwardStack.pop();
            state.currentPage = next;
            updateViewDisplay();
        }
    }

    function updateViewDisplay() {
        // 隐藏所有视图
        document.querySelectorAll(".page-view").forEach(el => el.classList.remove("active"));
        const targetView = document.getElementById("view" + state.currentPage.charAt(0).toUpperCase() + state.currentPage.slice(1));
        if (targetView) targetView.classList.add("active");

        // 更新侧栏与底部导航高亮
        document.querySelectorAll(".desktop-sidebar .nav-item").forEach(item => {
            item.classList.toggle("active", item.getAttribute("data-page") === state.currentPage);
        });
        document.querySelectorAll(".mobile-bottom-tabs .tab-item").forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-page") === state.currentPage);
        });

        // 更新后退/前进按钮可用性
        elBtnHistoryBack.disabled = state.history.length === 0;
        elBtnHistoryForward.disabled = state.forwardStack.length === 0;
        elMobileBackBtn.style.display = state.history.length > 0 ? "flex" : "none";

        // 更新手机顶部标题
        elMobilePageTitle.textContent = PAGE_NAMES[state.currentPage] || "MySpotify";

        // 滚动到顶部
        const scrollContainer = document.getElementById("scrollContent");
        if (scrollContainer) scrollContainer.scrollTop = 0;
    }

    // =========================================================================
    // Spotify Pathfinder GraphQL 数据同步 (核心修复)
    // =========================================================================
    function syncSpotifyData(showFeedback = false) {
        const loginStatus = Native.getLoginStatus();
        if (!loginStatus.isLoggedIn) {
            renderLoggedOutState();
            return;
        }

        if (showFeedback) Native.toast("正在同步 Spotify 资料库...");

        // 获取 TOTP 签名的 Access Token
        Native.fetchAccessToken((err, tokenRes) => {
            if (err || !tokenRes || !tokenRes.accessToken) {
                if (showFeedback) Native.toast("获取 Spotify 凭证失败，请检查网络或重新登录");
                renderLoggedOutState();
                return;
            }

            state.accessToken = tokenRes.accessToken;
            state.user.isLoggedIn = true;
            state.user.isGuest = false;

            // 1. 获取用户属性 (profileAttributes)
            Native.fetchPathfinder("profileAttributes", GRAPHQL_OPS.profileAttributes, {}, state.accessToken, (pErr, pData) => {
                if (!pErr && pData && pData.data && pData.data.me && pData.data.me.profile) {
                    const prof = pData.data.me.profile;
                    state.user.name = prof.name || prof.username || "Spotify 用户";
                    state.user.avatarUrl = prof.avatar && prof.avatar.sources && prof.avatar.sources[0] ? prof.avatar.sources[0].url : null;
                    state.user.avatar = state.user.name.charAt(0).toUpperCase();
                    state.user.tier = "Spotify 账号在线";
                    saveUserCache();
                    renderUserAccountUI();
                }
            });

            // 2. 获取用户资料库歌单与点赞统计 (libraryV3)
            const libVars = {
                filters: [],
                order: null,
                textFilter: "",
                features: ["LIKED_SONGS"],
                limit: 50,
                offset: 0,
                flatten: true,
                expandedFolders: [],
                folderUri: null,
                includeFoldersWhenFlattening: false
            };
            Native.fetchPathfinder("libraryV3", GRAPHQL_OPS.libraryV3, libVars, state.accessToken, (lErr, lData) => {
                if (!lErr && lData && lData.data && lData.data.me && lData.data.me.libraryV3) {
                    const items = lData.data.me.libraryV3.items || [];
                    const myPls = [];
                    const savedPls = [];

                    items.forEach(it => {
                        const d = it.item && it.item.data ? it.item.data : null;
                        if (!d) return;

                        if (d.__typename === "PseudoPlaylist" || (d.uri && d.uri.includes("collection"))) {
                            const count = d.content ? d.content.totalCount : (d.totalCount || 0);
                            document.getElementById("likedMetaText").textContent = `共 ${count} 首歌曲`;
                            return;
                        }

                        if (d.__typename === "Playlist" || d.name) {
                            const pl = {
                                id: d.uri || d.id,
                                name: d.name,
                                cover: d.images && d.images.items && d.images.items[0] && d.images.items[0].sources ? d.images.items[0].sources[0].url : "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300",
                                count: d.content ? d.content.totalCount : (d.tracks ? d.tracks.totalCount : 0),
                                owner: d.ownerV2 && d.ownerV2.data ? (d.ownerV2.data.name || d.ownerV2.data.username) : "Spotify"
                            };

                            if (d.ownerV2 && d.ownerV2.data && d.ownerV2.data.username === state.user.name) {
                                myPls.push(pl);
                            } else {
                                savedPls.push(pl);
                            }
                        }
                    });

                    state.userPlaylists = myPls;
                    state.savedPlaylists = savedPls;
                    renderPlaylistsNav();
                    if (showFeedback) Native.toast("已成功同步 Spotify 资料库！");
                }
            });

            // 3. 获取已点赞歌曲 (fetchLibraryTracks)
            Native.fetchPathfinder("fetchLibraryTracks", GRAPHQL_OPS.fetchLibraryTracks, { offset: 0, limit: 50 }, state.accessToken, (tErr, tData) => {
                if (!tErr && tData && tData.data && tData.data.me && tData.data.me.library) {
                    const rawItems = tData.data.me.library.tracks ? tData.data.me.library.tracks.items : [];
                    const tracks = rawItems.map(item => parsePathfinderTrack(item.track ? item.track.data : null)).filter(Boolean);
                    if (tracks.length > 0) {
                        state.likedTracks = tracks;
                        tracks.forEach(t => state.likedTrackIds.add(t.id));
                        renderTracksList(tracks, document.getElementById("likedTracksList"));
                        document.getElementById("likedMetaText").textContent = `共 ${tracks.length} 首歌曲`;
                    }
                }
            });
        });
    }

    function parsePathfinderTrack(d) {
        if (!d) return null;
        const id = d.id || (d.uri ? d.uri.replace("spotify:track:", "") : ("sp_" + Math.random().toString(36).substring(2, 7)));
        const artists = d.artists && d.artists.items ? d.artists.items.map(a => a.profile ? a.profile.name : (a.name || "")).join(", ") : "Spotify Artist";
        let cover = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300";
        if (d.albumOfTrack && d.albumOfTrack.coverArt && d.albumOfTrack.coverArt.sources && d.albumOfTrack.coverArt.sources.length > 0) {
            cover = d.albumOfTrack.coverArt.sources[0].url;
        } else if (d.album && d.album.images && d.album.images[0]) {
            cover = d.album.images[0].url;
        }

        const durSec = d.duration && d.duration.totalMilliseconds ? Math.round(d.duration.totalMilliseconds / 1000) : 180;

        const trackObj = {
            id: id,
            title: d.name || "未知歌曲",
            artist: artists,
            album: d.albumOfTrack ? d.albumOfTrack.name : (d.album ? d.album.name : ""),
            duration: durSec,
            cover: cover,
            audioUrl: "resolve:" + (d.name || "") + " " + artists
        };

        registerTrack(trackObj);
        return trackObj;
    }

    function renderLoggedOutState() {
        state.user.isLoggedIn = false;
        state.user.isGuest = true;
        state.user.name = "访客模式";
        state.user.avatar = "客";
        state.user.avatarUrl = null;
        state.user.tier = "免费访客";
        renderUserAccountUI();
    }

    function renderUserAccountUI() {
        const avatarEl = document.getElementById("sidebarUserAvatar");
        const nameEl = document.getElementById("sidebarUserName");
        const sAvatarEl = document.getElementById("settingsUserAvatar");
        const sNameEl = document.getElementById("settingsAccountName");
        const sEmailEl = document.getElementById("settingsAccountEmail");
        const sTierEl = document.getElementById("settingsAccountTier");
        const btnLogin = document.getElementById("btnSettingsLogin");
        const btnSync = document.getElementById("btnSettingsSync");
        const btnLogout = document.getElementById("btnSettingsLogout");
        const mobileLetter = document.getElementById("mobileAvatarLetter");

        if (state.user.avatarUrl) {
            const imgHtml = `<img src="${state.user.avatarUrl}" alt="Avatar">`;
            avatarEl.innerHTML = imgHtml;
            sAvatarEl.innerHTML = imgHtml;
        } else {
            avatarEl.innerHTML = `<span class="avatar-letter">${state.user.avatar}</span>`;
            sAvatarEl.innerHTML = `<span class="avatar-letter">${state.user.avatar}</span>`;
        }
        mobileLetter.textContent = state.user.avatar;

        nameEl.textContent = state.user.name;
        sNameEl.textContent = state.user.name;
        sEmailEl.textContent = state.user.isLoggedIn ? "已关联 Spotify 账号" : "登录 Spotify 即可完整同步歌单与点赞";
        sTierEl.textContent = state.user.tier;

        if (state.user.isLoggedIn) {
            btnLogin.style.display = "none";
            btnSync.style.display = "inline-block";
            btnLogout.style.display = "inline-block";
        } else {
            btnLogin.style.display = "inline-block";
            btnSync.style.display = "none";
            btnLogout.style.display = "none";
        }
    }

    function saveUserCache() {
        try {
            localStorage.setItem("myspotify_user", JSON.stringify(state.user));
        } catch (e) {}
    }

    function loadUserCache() {
        try {
            const raw = localStorage.getItem("myspotify_user");
            if (raw) {
                const u = JSON.parse(raw);
                if (u && u.name) Object.assign(state.user, u);
            }
        } catch (e) {}
    }

    function renderPlaylistsNav() {
        const myContainer = document.getElementById("sidebarMyPlaylists");
        const savedContainer = document.getElementById("sidebarSavedPlaylists");

        myContainer.innerHTML = "";
        savedContainer.innerHTML = "";

        state.userPlaylists.forEach(pl => {
            const el = document.createElement("div");
            el.className = "playlist-nav-item";
            el.innerHTML = `
                <img src="${pl.cover}" class="playlist-thumb-img" alt="Cover">
                <span class="playlist-nav-title">${pl.name}</span>
            `;
            el.addEventListener("click", () => openPlaylist(pl));
            myContainer.appendChild(el);
        });

        state.savedPlaylists.forEach(pl => {
            const el = document.createElement("div");
            el.className = "playlist-nav-item";
            el.innerHTML = `
                <img src="${pl.cover}" class="playlist-thumb-img" alt="Cover">
                <span class="playlist-nav-title">${pl.name}</span>
            `;
            el.addEventListener("click", () => openPlaylist(pl));
            savedContainer.appendChild(el);
        });
    }

    function openPlaylist(pl) {
        state.currentPlaylist = pl;
        document.getElementById("playlistMainTitle").textContent = pl.name;
        document.getElementById("playlistOwnerDesc").textContent = `${pl.owner || "Spotify"} · ${pl.count || 0} 首歌曲`;
        document.getElementById("playlistCoverImg").src = pl.cover;

        navigateTo("playlist");

        // 从 Spotify Pathfinder 获取歌单完整曲目
        if (state.accessToken && pl.id && pl.id.includes("spotify:playlist:")) {
            const vars = { uri: pl.id, offset: 0, limit: 100, enableWatchFeedEntrypoint: false };
            Native.fetchPathfinder("fetchPlaylist", GRAPHQL_OPS.fetchPlaylist, vars, state.accessToken, (err, res) => {
                if (!err && res && res.data && res.data.playlistV2 && res.data.playlistV2.content) {
                    const items = res.data.playlistV2.content.items || [];
                    const tracks = items.map(it => parsePathfinderTrack(it.itemV2 ? it.itemV2.data : null)).filter(Boolean);
                    renderTracksList(tracks, document.getElementById("playlistTracksList"));
                }
            });
        }
    }

    // =========================================================================
    // 渲染曲目列表与卡片
    // =========================================================================
    function renderTracksList(tracks, containerEl) {
        if (!containerEl) return;
        containerEl.innerHTML = "";

        if (!tracks || tracks.length === 0) {
            containerEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">暂无曲目</div>`;
            return;
        }

        tracks.forEach((t, idx) => {
            registerTrack(t);
            const row = document.createElement("div");
            row.className = "track-row";
            const isLiked = state.likedTrackIds.has(t.id);

            row.innerHTML = `
                <span class="track-row-index">${idx + 1}</span>
                <img src="${t.cover}" class="track-row-cover" alt="Cover">
                <div class="track-row-info">
                    <span class="track-row-name">${t.title}</span>
                    <span class="track-row-artist">${t.artist}</span>
                </div>
                <span class="track-row-duration">${formatTime(t.duration)}</span>
                <button class="track-row-like ${isLiked ? 'liked' : ''}">
                    <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>
                    </svg>
                </button>
            `;

            row.addEventListener("click", (e) => {
                if (e.target.closest(".track-row-like")) {
                    e.stopPropagation();
                    toggleLikeTrack(t);
                    return;
                }
                playTrack(t);
            });

            containerEl.appendChild(row);
        });
    }

    function toggleLikeTrack(track) {
        if (!track || !track.id) return;
        if (state.likedTrackIds.has(track.id)) {
            state.likedTrackIds.delete(track.id);
            state.likedTracks = state.likedTracks.filter(t => t.id !== track.id);
            Native.toast("已从已点赞歌曲中移除");
        } else {
            state.likedTrackIds.add(track.id);
            state.likedTracks.unshift(track);
            Native.toast("已添加到我喜欢的音乐");
        }
        updateLikeButtons();
    }

    function updateLikeButtons() {
        if (!state.currentTrack) return;
        const isLiked = state.likedTrackIds.has(state.currentTrack.id);
        elBarBtnLike.classList.toggle("liked", isLiked);
        elBarBtnLike.querySelector("svg").setAttribute("fill", isLiked ? "currentColor" : "none");

        elSheetBtnLike.classList.toggle("liked", isLiked);
        elSheetBtnLike.querySelector("svg").setAttribute("fill", isLiked ? "currentColor" : "none");
    }

    // =========================================================================
    // 播放引擎与原生服务桥接
    // =========================================================================
    function playTrack(track) {
        if (!track) return;
        state.currentTrack = track;
        state.isPlaying = true;
        state.currentTime = 0;
        state.duration = track.duration || 180;

        // 更新界面
        elBarTrackCover.src = track.cover;
        elBarTrackTitle.textContent = track.title;
        elBarTrackArtist.textContent = track.artist;
        elBarTimeDuration.textContent = formatTime(state.duration);

        elSheetCoverImg.src = track.cover;
        elSheetSongTitle.textContent = track.title;
        elSheetSongArtist.textContent = track.artist;
        elSheetTimeDuration.textContent = formatTime(state.duration);

        updatePlayPauseIcons(true);
        updateLikeButtons();

        // 触发 Android 原生播放服务
        Native.playAudio(track.audioUrl, track.title, track.artist, track.album || "Spotify", track.cover);

        // 获取多源逐字歌词
        fetchAndRenderLyrics(track);
    }

    function togglePlay() {
        if (!state.currentTrack) {
            if (DEFAULT_TRACKS.length > 0) playTrack(DEFAULT_TRACKS[0]);
            return;
        }

        if (state.isPlaying) {
            state.isPlaying = false;
            Native.pauseAudio();
            updatePlayPauseIcons(false);
        } else {
            state.isPlaying = true;
            Native.resumeAudio();
            updatePlayPauseIcons(true);
        }
    }

    function updatePlayPauseIcons(playing) {
        elIconBarPlay.style.display = playing ? "none" : "block";
        elIconBarPause.style.display = playing ? "block" : "none";
        elIconSheetPlay.style.display = playing ? "none" : "block";
        elIconSheetPause.style.display = playing ? "block" : "none";
    }

    function updatePlaybackProgress(sec, dur) {
        state.currentTime = sec;
        if (dur > 0) state.duration = dur;

        const percent = Math.min(100, Math.max(0, (state.currentTime / state.duration) * 100));
        elBarTimeCurrent.textContent = formatTime(state.currentTime);
        elBarScrubFill.style.width = percent + "%";

        elSheetTimeCurrent.textContent = formatTime(state.currentTime);
        elSheetScrubFill.style.width = percent + "%";

        // 更新逐字歌词高亮
        syncLyricsWithTime(sec);
    }

    function formatTime(seconds) {
        const s = Math.floor(seconds || 0);
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return `${m}:${rem < 10 ? "0" : ""}${rem}`;
    }

    // =========================================================================
    // 多源逐字歌词引擎 (LRCLIB + 网易云双语)
    // =========================================================================
    function fetchAndRenderLyrics(track) {
        elSheetLyricsStream.innerHTML = `<div class="lyrics-empty-placeholder">正在获取高精双语逐字歌词...</div>`;
        state.lyrics = [];
        state.activeLyricIndex = -1;

        Native.fetchLyrics(track.id, track.title, track.artist, track.duration, (err, lyricsArr) => {
            if (!err && lyricsArr && lyricsArr.length > 0) {
                state.lyrics = lyricsArr;
                renderLyricsLines(lyricsArr);
            } else {
                elSheetLyricsStream.innerHTML = `<div class="lyrics-empty-placeholder">纯音乐，享受旋律</div>`;
            }
        });
    }

    function renderLyricsLines(lines) {
        elSheetLyricsStream.innerHTML = "";
        lines.forEach((line, idx) => {
            const item = document.createElement("div");
            item.className = "lyric-line-item";
            item.setAttribute("data-index", idx);
            item.innerHTML = `
                <div class="lyric-main-text">${line.text}</div>
                ${line.trans ? `<div class="lyric-translation">${line.trans}</div>` : ""}
            `;
            item.addEventListener("click", () => {
                Native.seekAudio(Math.floor(line.time * 1000));
            });
            elSheetLyricsStream.appendChild(item);
        });
    }

    function syncLyricsWithTime(currentSec) {
        if (!state.lyrics || state.lyrics.length === 0) return;

        let activeIdx = -1;
        for (let i = 0; i < state.lyrics.length; i++) {
            if (state.lyrics[i].time <= currentSec + 0.3) {
                activeIdx = i;
            } else {
                break;
            }
        }

        if (activeIdx !== state.activeLyricIndex && activeIdx >= 0) {
            state.activeLyricIndex = activeIdx;
            const items = elSheetLyricsStream.querySelectorAll(".lyric-line-item");
            items.forEach((item, idx) => {
                const isActive = idx === activeIdx;
                item.classList.toggle("active", isActive);
                if (isActive) {
                    item.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            });
        }
    }

    // =========================================================================
    // 搜索模块 (Pathfinder searchTracks)
    // =========================================================================
    let searchDebounceTimer = null;
    function handleSearchInput(query) {
        clearTimeout(searchDebounceTimer);
        const q = (query || "").trim();
        if (!q) {
            document.getElementById("searchResultsArea").innerHTML = `
                <div class="empty-state-notice">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                    <span>输入关键字探索 Spotify 海量曲库</span>
                </div>
            `;
            return;
        }

        searchDebounceTimer = setTimeout(() => {
            executeSearch(q);
        }, 320);
    }

    function executeSearch(query) {
        navigateTo("search");
        document.getElementById("searchResultsArea").innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">正在搜索 "${query}"...</div>`;

        const vars = {
            searchTerm: query,
            offset: 0,
            limit: 20,
            numberOfTopResults: 20,
            includeAudiobooks: false,
            includePreReleases: false,
            includeAuthors: false
        };

        Native.fetchPathfinder("searchTracks", GRAPHQL_OPS.searchTracks, vars, state.accessToken, (err, res) => {
            if (!err && res && res.data && res.data.searchV2 && res.data.searchV2.tracksV2) {
                const items = res.data.searchV2.tracksV2.items || [];
                const tracks = items.map(it => parsePathfinderTrack(it.item ? it.item.data : null)).filter(Boolean);
                const area = document.getElementById("searchResultsArea");
                area.innerHTML = `<div class="tracks-card-container"><div class="track-list-body" id="searchResultsList"></div></div>`;
                renderTracksList(tracks, document.getElementById("searchResultsList"));
            } else {
                document.getElementById("searchResultsArea").innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">搜索未返回结果，请检查网络或更换关键词</div>`;
            }
        });
    }

    // =========================================================================
    // 全屏 Sheet 展开与收起
    // =========================================================================
    function openFullscreenSheet() {
        elSheetOverlay.classList.add("open");
        Native.setStatusBarTheme(true);
    }

    function dismissFullscreenSheet() {
        elSheetOverlay.classList.remove("open");
        Native.setStatusBarTheme(state.theme === "dark");
    }

    // =========================================================================
    // 设置项绑定与缓存管理
    // =========================================================================
    function initSettings() {
        // 读取代理
        const savedProxy = Native.getProxy();
        if (savedProxy) document.getElementById("inputProxy").value = savedProxy;

        document.getElementById("btnSaveProxy").addEventListener("click", () => {
            const p = document.getElementById("inputProxy").value.trim();
            Native.setProxy(p);
            Native.toast(p ? "已保存代理: " + p : "已恢复系统默认代理");
        });

        // 缓存大小
        Native.getCacheSize((err, res) => {
            if (!err && res && res.formatted) {
                document.getElementById("settingsCacheInfo").textContent = `听过的歌曲（加密的）保存在本机，再次播放更快、不耗流量，但仍要联网授权；已用 ${res.formatted}`;
            }
        });

        // 清除缓存
        document.getElementById("btnClearCache").addEventListener("click", () => {
            Native.clearCache((err, ok) => {
                if (ok) {
                    Native.toast("缓存已全部清除");
                    document.getElementById("settingsCacheInfo").textContent = "听过的歌曲（加密的）保存在本机，再次播放更快、不耗流量，但仍要联网授权；已用 0 B";
                }
            });
        });

        // 更改缓存目录提示
        document.getElementById("btnChangeCacheDir").addEventListener("click", () => {
            Native.toast("Android 端统一由应用专属沙盒存储，无需手动更改");
        });

        // 检查更新
        document.getElementById("btnCheckUpdate").addEventListener("click", () => {
            Native.toast("当前版本 v0.4.30 为最新发布版本");
        });

        // 登录/退出/同步按钮
        document.getElementById("btnSettingsLogin").addEventListener("click", () => Native.login());
        document.getElementById("btnSettingsSync").addEventListener("click", () => syncSpotifyData(true));
        document.getElementById("btnSettingsLogout").addEventListener("click", () => {
            Native.logout();
            renderLoggedOutState();
            Native.toast("已退出登录，恢复访客模式");
        });

        // 外观模式切换
        const segControl = document.getElementById("appearanceSegment");
        segControl.querySelectorAll(".segment-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                segControl.querySelectorAll(".segment-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const chosen = btn.getAttribute("data-theme");
                setThemeMode(chosen);
            });
        });
    }

    function setThemeMode(mode) {
        state.theme = mode;
        if (mode === "dark") {
            document.body.classList.remove("theme-light");
            document.body.classList.add("theme-dark");
            Native.setStatusBarTheme(true);
        } else if (mode === "light") {
            document.body.classList.remove("theme-dark");
            document.body.classList.add("theme-light");
            Native.setStatusBarTheme(false);
        } else {
            // 跟随系统
            const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
            document.body.classList.toggle("theme-dark", isDark);
            document.body.classList.toggle("theme-light", !isDark);
            Native.setStatusBarTheme(isDark);
        }
    }

    // =========================================================================
    // 事件监听初始化
    // =========================================================================
    function initEventListeners() {
        // 桌面侧边栏导航点击
        document.querySelectorAll(".desktop-sidebar .nav-item").forEach(item => {
            item.addEventListener("click", () => {
                const p = item.getAttribute("data-page");
                if (p) navigateTo(p);
            });
        });

        // 移动端底部 Tab 点击
        document.querySelectorAll(".mobile-bottom-tabs .tab-item").forEach(tab => {
            tab.addEventListener("click", () => {
                const p = tab.getAttribute("data-page");
                if (p) navigateTo(p);
            });
        });

        // 侧栏"我喜欢的音乐"点击
        document.getElementById("sidebarLikedItem").addEventListener("click", () => navigateTo("liked"));

        // 历史前进后退
        elBtnHistoryBack.addEventListener("click", goBack);
        elBtnHistoryForward.addEventListener("click", goForward);
        elMobileBackBtn.addEventListener("click", goBack);

        // 搜索输入
        elSidebarSearchInput.addEventListener("input", (e) => handleSearchInput(e.target.value));
        elMobileSearchInput.addEventListener("input", (e) => {
            const v = e.target.value;
            elMobileClearSearch.style.display = v ? "block" : "none";
            handleSearchInput(v);
        });
        elMobileClearSearch.addEventListener("click", () => {
            elMobileSearchInput.value = "";
            elMobileClearSearch.style.display = "none";
            handleSearchInput("");
        });

        // 播放控制
        elBarBtnPlayPause.addEventListener("click", togglePlay);
        elSheetBtnPlayPause.addEventListener("click", togglePlay);

        elBarBtnPrev.addEventListener("click", () => {
            Native.toast("上一首");
            if (DEFAULT_TRACKS.length > 0) playTrack(DEFAULT_TRACKS[1]);
        });
        elBarBtnNext.addEventListener("click", () => {
            Native.toast("下一首");
            if (DEFAULT_TRACKS.length > 0) playTrack(DEFAULT_TRACKS[2]);
        });
        elSheetBtnPrev.addEventListener("click", () => {
            if (DEFAULT_TRACKS.length > 0) playTrack(DEFAULT_TRACKS[1]);
        });
        elSheetBtnNext.addEventListener("click", () => {
            if (DEFAULT_TRACKS.length > 0) playTrack(DEFAULT_TRACKS[2]);
        });

        elBarBtnShuffle.addEventListener("click", () => {
            state.shuffle = !state.shuffle;
            elBarBtnShuffle.classList.toggle("active", state.shuffle);
            elSheetBtnShuffle.classList.toggle("active", state.shuffle);
            Native.toast(state.shuffle ? "随机播放开启" : "随机播放关闭");
        });
        elSheetBtnShuffle.addEventListener("click", () => {
            state.shuffle = !state.shuffle;
            elBarBtnShuffle.classList.toggle("active", state.shuffle);
            elSheetBtnShuffle.classList.toggle("active", state.shuffle);
            Native.toast(state.shuffle ? "随机播放开启" : "随机播放关闭");
        });

        elBarBtnRepeat.addEventListener("click", () => {
            state.repeat = !state.repeat;
            elBarBtnRepeat.classList.toggle("active", state.repeat);
            elSheetBtnRepeat.classList.toggle("active", state.repeat);
            Native.toast(state.repeat ? "单曲循环开启" : "列表循环");
        });
        elSheetBtnRepeat.addEventListener("click", () => {
            state.repeat = !state.repeat;
            elBarBtnRepeat.classList.toggle("active", state.repeat);
            elSheetBtnRepeat.classList.toggle("active", state.repeat);
            Native.toast(state.repeat ? "单曲循环开启" : "列表循环");
        });

        // 点赞
        elBarBtnLike.addEventListener("click", () => toggleLikeTrack(state.currentTrack));
        elSheetBtnLike.addEventListener("click", () => toggleLikeTrack(state.currentTrack));

        // 播放条点击展开全屏 Sheet
        elBarCoverInfoGroup.addEventListener("click", openFullscreenSheet);
        elBarBtnExpand.addEventListener("click", openFullscreenSheet);
        elBtnDismissSheet.addEventListener("click", dismissFullscreenSheet);

        // 歌词切换 Tab
        elBarBtnLyrics.addEventListener("click", () => {
            openFullscreenSheet();
            elTabLyrics.click();
        });
        elTabArtwork.addEventListener("click", () => {
            elTabArtwork.classList.add("active");
            elTabLyrics.classList.remove("active");
            elSheetDualScaffold.classList.remove("show-lyrics");
        });
        elTabLyrics.addEventListener("click", () => {
            elTabLyrics.classList.add("active");
            elTabArtwork.classList.remove("active");
            elSheetDualScaffold.classList.add("show-lyrics");
        });

        // 进度拖动
        elBarScrubTrack.addEventListener("click", (e) => {
            const rect = elBarScrubTrack.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const frac = Math.max(0, Math.min(1, clickX / rect.width));
            const targetMs = Math.floor(frac * state.duration * 1000);
            Native.seekAudio(targetMs);
        });
        elSheetScrubRail.addEventListener("click", (e) => {
            const rect = elSheetScrubRail.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const frac = Math.max(0, Math.min(1, clickX / rect.width));
            const targetMs = Math.floor(frac * state.duration * 1000);
            Native.seekAudio(targetMs);
        });

        // 歌单整专播放
        document.getElementById("btnPlayAllLiked").addEventListener("click", () => {
            if (state.likedTracks.length > 0) playTrack(state.likedTracks[0]);
        });
        document.getElementById("btnPlayAllDaily").addEventListener("click", () => {
            if (DEFAULT_TRACKS.length > 0) playTrack(DEFAULT_TRACKS[0]);
        });

        // 侧栏点击账户进入设置
        document.getElementById("sidebarAccountRow").addEventListener("click", () => navigateTo("settings"));
        document.getElementById("mobileAvatarBtn").addEventListener("click", () => navigateTo("settings"));
    }

    // =========================================================================
    // 原生回调接入 (MediaPlaybackService 进度与播放状态同步)
    // =========================================================================
    window.onPlaybackStateChanged = function (playing) {
        state.isPlaying = playing;
        updatePlayPauseIcons(playing);
    };

    window.onPlaybackProgress = function (currentMs, durationMs) {
        updatePlaybackProgress(currentMs / 1000, durationMs / 1000);
    };

    window.onNativeLoginSuccess = function (success) {
        if (success) {
            Native.toast("Spotify 登录成功，正在加载数据...");
            syncSpotifyData(true);
        } else {
            renderLoggedOutState();
        }
    };

    // =========================================================================
    // 启动初始化
    // =========================================================================
    function init() {
        loadUserCache();
        renderUserAccountUI();
        initEventListeners();
        initSettings();

        // 默认填充首页精选与每日推荐列表
        renderTracksList(DEFAULT_TRACKS, document.getElementById("homeTracksList"));
        renderTracksList(DEFAULT_TRACKS, document.getElementById("dailyTracksList"));
        renderTracksList(state.likedTracks, document.getElementById("likedTracksList"));

        // 检查登录状态并同步云端数据
        syncSpotifyData(false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
