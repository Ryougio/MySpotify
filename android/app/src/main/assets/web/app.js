/**
 * Spotify Mobile Edition (Authentic Android 9.1.98 Parity)
 * Pure Dark Canvas (#121212), Spotify Green (#1ed760), 3-Tab Bottom Nav,
 * Floating Mini-Player, Activity Now Playing with Lyrics Card.
 * Powered by Spotify Pathfinder GraphQL, TOTP Signature, LRCLIB & NetEase.
 */

(function () {
    "use strict";

    // Spotify Pathfinder GraphQL Operation Hashes
    const GRAPHQL_OPS = {
        profileAttributes: "08ffb4730af3746e04a8301396f20875dbbce10c75243803091a9274eacc8ac0",
        libraryV3: "390c78e5b951029bad359785e69b07b536a509c581cbcd0aded5e5067f187455",
        fetchLibraryTracks: "087278b20b743578a6262c2b0b4bcd20d879c503cc359a2285baf083ef944240",
        fetchPlaylist: "21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf",
        searchTracks: "b02683192a98dde7966b5e6655a79eeb62713eab703eda9902c932818dd52751",
        browseAll: "dbd8b55e09a58afc52eab438bc228ba28fd72ac2f2148c6c26354980e4579001"
    };

    // 默认高保真推荐曲库 (离线或访客备用)
    const FEATURED_TRACKS = [
        {
            id: "sp-1",
            title: "Cruel Summer",
            artist: "Taylor Swift",
            album: "Lover",
            duration: 178,
            cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=85",
            audioUrl: "https://cdn.freesound.org/previews/612/612088_5674468-lq.mp3",
            color: "#3a1d28"
        },
        {
            id: "sp-2",
            title: "Blinding Lights",
            artist: "The Weeknd",
            album: "After Hours",
            duration: 200,
            cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=85",
            audioUrl: "https://cdn.freesound.org/previews/612/612092_5674468-lq.mp3",
            color: "#4a151b"
        },
        {
            id: "sp-3",
            title: "Starboy",
            artist: "The Weeknd, Daft Punk",
            album: "Starboy",
            duration: 230,
            cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=85",
            audioUrl: "https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3",
            color: "#1c2638"
        },
        {
            id: "sp-4",
            title: "As It Was",
            artist: "Harry Styles",
            album: "Harry's House",
            duration: 167,
            cover: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=85",
            audioUrl: "https://cdn.freesound.org/previews/612/612088_5674468-lq.mp3",
            color: "#283424"
        }
    ];

    // 分类卡片数据
    const CATEGORIES = [
        { name: "流行", color: "#e91e63", img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200" },
        { name: "嘻哈", color: "#f57c00", img: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200" },
        { name: "摇滚", color: "#d32f2f", img: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=200" },
        { name: "电子 / 舞曲", color: "#00acc1", img: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=200" },
        { name: "独立", color: "#00897b", img: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=200" },
        { name: "华语流行", color: "#7b1fa2", img: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200" },
        { name: "车载与自驾", color: "#3949ab", img: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200" },
        { name: "专注与学习", color: "#455a64", img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200" }
    ];

    // 全局曲目注册表
    const trackRegistry = new Map();
    function registerTrack(t) {
        if (t && t.id) trackRegistry.set(t.id, t);
    }
    FEATURED_TRACKS.forEach(registerTrack);

    // 运行时状态
    const state = {
        currentTab: "home",
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        shuffle: false,
        repeat: false,
        lyrics: [],
        activeLyricIndex: -1,
        likedTrackIds: new Set(["sp-1"]),
        likedTracks: [...FEATURED_TRACKS.slice(0, 1)],
        userPlaylists: [],
        currentPlaylist: null,
        user: {
            isLoggedIn: false,
            isGuest: true,
            name: "访客模式",
            avatar: "S",
            avatarUrl: null,
            tier: "免费访客"
        },
        accessToken: null
    };

    // 原生 Android 桥接
    const Native = {
        toast(msg) {
            if (window.AndroidBridge && window.AndroidBridge.showToast) {
                window.AndroidBridge.showToast(msg);
            }
        },
        vibrate(ms) {
            if (window.AndroidBridge && window.AndroidBridge.vibrate) {
                window.AndroidBridge.vibrate(ms || 15);
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
        fetchPathfinder(op, hash, vars, token, callback) {
            if (window.AndroidBridge && window.AndroidBridge.fetchPathfinder) {
                const cbName = "_cbGql_" + Math.random().toString(36).substring(2, 9);
                window[cbName] = function (err, res) {
                    delete window[cbName];
                    callback(err, res ? JSON.parse(res) : null);
                };
                window.AndroidBridge.fetchPathfinder(
                    op,
                    hash,
                    vars ? JSON.stringify(vars) : "{}",
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
        setProxy(p) {
            if (window.AndroidBridge && window.AndroidBridge.setProxy) {
                window.AndroidBridge.setProxy(p);
            }
        },
        getProxy() {
            if (window.AndroidBridge && window.AndroidBridge.getProxy) {
                return window.AndroidBridge.getProxy();
            }
            return "";
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

    // DOM 引用
    const elBottomNav = document.getElementById("bottomNav");
    const elMiniPlayer = document.getElementById("miniPlayerBar");
    const elMiniCoverImg = document.getElementById("miniCoverImg");
    const elMiniTitle = document.getElementById("miniTitle");
    const elMiniArtist = document.getElementById("miniArtist");
    const elMiniBtnLike = document.getElementById("miniBtnLike");
    const elMiniBtnPlayPause = document.getElementById("miniBtnPlayPause");
    const elMiniIconPlay = document.getElementById("miniIconPlay");
    const elMiniIconPause = document.getElementById("miniIconPause");
    const elMiniProgressFill = document.getElementById("miniProgressFill");
    const elMiniMetaClickArea = document.getElementById("miniMetaClickArea");

    // 全屏播放器 DOM
    const elNpFullscreen = document.getElementById("npFullscreen");
    const elBtnDismissNp = document.getElementById("btnDismissNp");
    const elNpGradientBg = document.getElementById("npGradientBg");
    const elNpPlayingFrom = document.getElementById("npPlayingFrom");
    const elNpLargeCoverImg = document.getElementById("npLargeCoverImg");
    const elNpTrackTitle = document.getElementById("npTrackTitle");
    const elNpTrackArtist = document.getElementById("npTrackArtist");
    const elNpBtnLike = document.getElementById("npBtnLike");
    const elNpScrubRail = document.getElementById("npScrubRail");
    const elNpScrubFill = document.getElementById("npScrubFill");
    const elNpTimeCurrent = document.getElementById("npTimeCurrent");
    const elNpTimeDuration = document.getElementById("npTimeDuration");
    const elNpBtnShuffle = document.getElementById("npBtnShuffle");
    const elNpBtnPrev = document.getElementById("npBtnPrev");
    const elNpBtnPlayPause = document.getElementById("npBtnPlayPause");
    const elNpIconPlay = document.getElementById("npIconPlay");
    const elNpIconPause = document.getElementById("npIconPause");
    const elNpBtnNext = document.getElementById("npBtnNext");
    const elNpBtnRepeat = document.getElementById("npBtnRepeat");
    const elLyricsStream = document.getElementById("lyricsStream");
    const elNpLyricsCard = document.getElementById("npLyricsCard");
    const elBtnExpandLyrics = document.getElementById("btnExpandLyrics");

    // =========================================================================
    // 选项卡路由与切换 (3大主Tab: home, search, library, 以及 playlist, settings)
    // =========================================================================
    function switchTab(tabId) {
        state.currentTab = tabId;

        // 更新内容区展示
        document.querySelectorAll(".sp-tab-view").forEach(v => v.classList.remove("active"));
        const targetView = document.getElementById("view" + tabId.charAt(0).toUpperCase() + tabId.slice(1));
        if (targetView) targetView.classList.add("active");

        // 更新底部导航选中高亮
        document.querySelectorAll(".nav-tab").forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-tab") === tabId);
        });

        // 详情页时隐藏底部导航，主页/搜索/音乐库时显示
        const isDetail = (tabId === "playlist" || tabId === "settings");
        elBottomNav.style.display = isDetail ? "none" : "flex";

        // 滚动重置
        const scroller = document.getElementById("mainScroll");
        if (scroller) scroller.scrollTop = 0;
    }

    // =========================================================================
    // Spotify 云端数据同步 (Pathfinder GraphQL)
    // =========================================================================
    function syncSpotifyData(showToast = false) {
        const loginStatus = Native.getLoginStatus();
        if (!loginStatus.isLoggedIn) {
            renderLoggedOutUI();
            return;
        }

        if (showToast) Native.toast("正在连接 Spotify 资料库...");

        Native.fetchAccessToken((err, tokenRes) => {
            if (err || !tokenRes || !tokenRes.accessToken) {
                if (showToast) Native.toast("获取 Spotify 凭证失败，请检查网络或重新登录");
                renderLoggedOutUI();
                return;
            }

            state.accessToken = tokenRes.accessToken;
            state.user.isLoggedIn = true;
            state.user.isGuest = false;

            // 1. 用户个人档案
            Native.fetchPathfinder("profileAttributes", GRAPHQL_OPS.profileAttributes, {}, state.accessToken, (pErr, pData) => {
                if (!pErr && pData && pData.data && pData.data.me && pData.data.me.profile) {
                    const prof = pData.data.me.profile;
                    state.user.name = prof.name || prof.username || "Spotify 用户";
                    state.user.avatarUrl = prof.avatar && prof.avatar.sources && prof.avatar.sources[0] ? prof.avatar.sources[0].url : null;
                    state.user.avatar = state.user.name.charAt(0).toUpperCase();
                    state.user.tier = "Spotify 账号在线";
                    saveUserCache();
                    renderAccountUI();
                }
            });

            // 2. 音乐库歌单
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
                    const pls = [];
                    items.forEach(it => {
                        const d = it.item && it.item.data ? it.item.data : null;
                        if (!d) return;

                        if (d.__typename === "PseudoPlaylist" || (d.uri && d.uri.includes("collection"))) {
                            const count = d.content ? d.content.totalCount : (d.totalCount || 0);
                            document.getElementById("libLikedCountText").textContent = `📌 播放列表 · ${count} 首歌曲`;
                            return;
                        }

                        if (d.__typename === "Playlist" || d.name) {
                            pls.push({
                                id: d.uri || d.id,
                                name: d.name,
                                cover: d.images && d.images.items && d.images.items[0] && d.images.items[0].sources ? d.images.items[0].sources[0].url : "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300",
                                count: d.content ? d.content.totalCount : (d.tracks ? d.tracks.totalCount : 0),
                                owner: d.ownerV2 && d.ownerV2.data ? (d.ownerV2.data.name || d.ownerV2.data.username) : "Spotify"
                            });
                        }
                    });

                    state.userPlaylists = pls;
                    renderLibraryPlaylists(pls);
                    if (showToast) Native.toast("Spotify 资料库同步完成！");
                }
            });

            // 3. 已点赞歌曲
            Native.fetchPathfinder("fetchLibraryTracks", GRAPHQL_OPS.fetchLibraryTracks, { offset: 0, limit: 50 }, state.accessToken, (tErr, tData) => {
                if (!tErr && tData && tData.data && tData.data.me && tData.data.me.library) {
                    const raw = tData.data.me.library.tracks ? tData.data.me.library.tracks.items : [];
                    const tracks = raw.map(item => parseGqlTrack(item.track ? item.track.data : null)).filter(Boolean);
                    if (tracks.length > 0) {
                        state.likedTracks = tracks;
                        tracks.forEach(t => state.likedTrackIds.add(t.id));
                        document.getElementById("libLikedCountText").textContent = `📌 播放列表 · ${tracks.length} 首歌曲`;
                    }
                }
            });
        });
    }

    function parseGqlTrack(d) {
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
            title: d.name || "未知曲目",
            artist: artists,
            album: d.albumOfTrack ? d.albumOfTrack.name : (d.album ? d.album.name : ""),
            duration: durSec,
            cover: cover,
            audioUrl: "resolve:" + (d.name || "") + " " + artists,
            color: "#301d2b"
        };
        registerTrack(trackObj);
        return trackObj;
    }

    function renderLoggedOutUI() {
        state.user.isLoggedIn = false;
        state.user.isGuest = true;
        state.user.name = "访客模式";
        state.user.avatar = "S";
        state.user.avatarUrl = null;
        state.user.tier = "免费访客";
        renderAccountUI();
    }

    function renderAccountUI() {
        const avatars = [
            document.getElementById("homeAvatarLetter"),
            document.getElementById("searchAvatarLetter"),
            document.getElementById("libAvatarLetter")
        ];
        const sAvatar = document.getElementById("settingsUserAvatar");
        const sName = document.getElementById("settingsAccountName");
        const sEmail = document.getElementById("settingsAccountEmail");
        const sTier = document.getElementById("settingsAccountTier");
        const rowLogin = document.getElementById("rowLogin");
        const rowSync = document.getElementById("rowSync");
        const rowLogout = document.getElementById("rowLogout");

        avatars.forEach(el => {
            if (el) el.textContent = state.user.avatar;
        });

        if (state.user.avatarUrl) {
            sAvatar.innerHTML = `<img src="${state.user.avatarUrl}" alt="Avatar">`;
        } else {
            sAvatar.innerHTML = `<span class="avatar-letter">${state.user.avatar}</span>`;
        }

        sName.textContent = state.user.name;
        sEmail.textContent = state.user.isLoggedIn ? "已关联 Spotify 账号" : "登录 Spotify 同步个人音乐库";
        sTier.textContent = state.user.tier;

        if (state.user.isLoggedIn) {
            rowLogin.style.display = "none";
            rowSync.style.display = "flex";
            rowLogout.style.display = "flex";
        } else {
            rowLogin.style.display = "flex";
            rowSync.style.display = "none";
            rowLogout.style.display = "none";
        }
    }

    function saveUserCache() {
        try {
            localStorage.setItem("myspotify_m_user", JSON.stringify(state.user));
        } catch (e) {}
    }

    function loadUserCache() {
        try {
            const raw = localStorage.getItem("myspotify_m_user");
            if (raw) Object.assign(state.user, JSON.parse(raw));
        } catch (e) {}
    }

    // =========================================================================
    // 渲染模块：歌单、曲目与探索卡片
    // =========================================================================
    function renderLibraryPlaylists(pls) {
        const container = document.getElementById("libraryPlaylistsContainer");
        container.innerHTML = "";
        pls.forEach(pl => {
            const row = document.createElement("div");
            row.className = "sp-library-row";
            row.innerHTML = `
                <div class="lib-cover-box">
                    <img src="${pl.cover}" alt="Cover">
                </div>
                <div class="lib-meta-col">
                    <span class="lib-row-title">${pl.name}</span>
                    <span class="lib-row-sub">播放列表 · ${pl.owner}</span>
                </div>
            `;
            row.addEventListener("click", () => openPlaylist(pl));
            container.appendChild(row);
        });
    }

    function openPlaylist(pl) {
        state.currentPlaylist = pl;
        document.getElementById("playlistNavTitle").textContent = pl.name;
        document.getElementById("playlistHeroName").textContent = pl.name;
        document.getElementById("playlistHeroMeta").textContent = `${pl.owner || "Spotify"} · ${pl.count || 0} 首歌曲`;
        document.getElementById("playlistHeroCover").src = pl.cover;

        switchTab("playlist");

        // 若为我喜欢的音乐
        if (pl.id === "liked") {
            renderTracksList(state.likedTracks, document.getElementById("playlistTracksList"));
            return;
        }

        // Spotify 云端歌单拉取曲目
        if (state.accessToken && pl.id && pl.id.includes("spotify:playlist:")) {
            const vars = { uri: pl.id, offset: 0, limit: 100, enableWatchFeedEntrypoint: false };
            Native.fetchPathfinder("fetchPlaylist", GRAPHQL_OPS.fetchPlaylist, vars, state.accessToken, (err, res) => {
                if (!err && res && res.data && res.data.playlistV2 && res.data.playlistV2.content) {
                    const items = res.data.playlistV2.content.items || [];
                    const tracks = items.map(it => parseGqlTrack(it.itemV2 ? it.itemV2.data : null)).filter(Boolean);
                    renderTracksList(tracks, document.getElementById("playlistTracksList"));
                }
            });
        }
    }

    function renderTracksList(tracks, containerEl) {
        if (!containerEl) return;
        containerEl.innerHTML = "";

        if (!tracks || tracks.length === 0) {
            containerEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--sp-text-subdued);font-size:13px;">暂无曲目</div>`;
            return;
        }

        tracks.forEach(t => {
            registerTrack(t);
            const item = document.createElement("div");
            item.className = "sp-track-item";
            const isLiked = state.likedTrackIds.has(t.id);
            const isPlayingThis = state.currentTrack && state.currentTrack.id === t.id;

            item.innerHTML = `
                <img src="${t.cover}" class="track-thumb-img" alt="Cover">
                <div class="track-meta-stack">
                    <span class="track-main-name ${isPlayingThis ? 'playing' : ''}">${t.title}</span>
                    <span class="track-sub-artist">${t.artist}</span>
                </div>
                <button class="track-action-btn ${isLiked ? 'liked' : ''}">
                    <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>
                    </svg>
                </button>
            `;

            item.addEventListener("click", (e) => {
                if (e.target.closest(".track-action-btn")) {
                    e.stopPropagation();
                    toggleLikeTrack(t);
                    return;
                }
                playTrack(t);
            });

            containerEl.appendChild(item);
        });
    }

    function toggleLikeTrack(track) {
        if (!track || !track.id) return;
        if (state.likedTrackIds.has(track.id)) {
            state.likedTrackIds.delete(track.id);
            state.likedTracks = state.likedTracks.filter(t => t.id !== track.id);
            Native.toast("已从已点赞歌曲移除");
        } else {
            state.likedTrackIds.add(track.id);
            state.likedTracks.unshift(track);
            Native.toast("已添加到已点赞歌曲");
        }
        updateLikeState();
    }

    function updateLikeState() {
        if (!state.currentTrack) return;
        const liked = state.likedTrackIds.has(state.currentTrack.id);
        elMiniBtnLike.classList.toggle("liked", liked);
        elMiniBtnLike.querySelector("svg").setAttribute("fill", liked ? "currentColor" : "none");

        elNpBtnLike.classList.toggle("liked", liked);
        elNpBtnLike.querySelector("svg").setAttribute("fill", liked ? "currentColor" : "none");
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

        // 更新迷你播放条
        elMiniCoverImg.src = track.cover;
        elMiniTitle.textContent = track.title;
        elMiniArtist.textContent = track.artist;
        elMiniPlayer.style.display = "flex";

        // 更新全屏播放界面
        elNpLargeCoverImg.src = track.cover;
        elNpTrackTitle.textContent = track.title;
        elNpTrackArtist.textContent = track.artist;
        elNpTimeDuration.textContent = formatTime(state.duration);
        if (track.color) {
            elNpGradientBg.style.background = `linear-gradient(180deg, ${track.color} 0%, #121212 65%)`;
        }

        updatePlayPauseIcons(true);
        updateLikeState();

        // 唤醒 Android 前台播放服务
        Native.playAudio(track.audioUrl, track.title, track.artist, track.album || "Spotify", track.cover);

        // 加载双语逐字歌词
        fetchLyrics(track);
    }

    function togglePlay() {
        if (!state.currentTrack) {
            if (FEATURED_TRACKS.length > 0) playTrack(FEATURED_TRACKS[0]);
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
        elMiniIconPlay.style.display = playing ? "none" : "block";
        elMiniIconPause.style.display = playing ? "block" : "none";
        elNpIconPlay.style.display = playing ? "none" : "block";
        elNpIconPause.style.display = playing ? "block" : "none";
    }

    function updateProgress(sec, dur) {
        state.currentTime = sec;
        if (dur > 0) state.duration = dur;

        const frac = Math.min(100, Math.max(0, (state.currentTime / state.duration) * 100));
        elMiniProgressFill.style.width = frac + "%";
        elNpScrubFill.style.width = frac + "%";
        elNpTimeCurrent.textContent = formatTime(state.currentTime);

        syncLyrics(sec);
    }

    function formatTime(seconds) {
        const s = Math.floor(seconds || 0);
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return `${m}:${rem < 10 ? "0" : ""}${rem}`;
    }

    // =========================================================================
    // 歌词解析与实时逐字联动
    // =========================================================================
    function fetchLyrics(track) {
        elLyricsStream.innerHTML = `<div class="lyrics-loading-text">正在同步歌词...</div>`;
        state.lyrics = [];
        state.activeLyricIndex = -1;

        Native.fetchLyrics(track.id, track.title, track.artist, track.duration, (err, lyricsArr) => {
            if (!err && lyricsArr && lyricsArr.length > 0) {
                state.lyrics = lyricsArr;
                renderLyrics(lyricsArr);
            } else {
                elLyricsStream.innerHTML = `<div class="lyrics-loading-text">享受旋律，暂无歌词</div>`;
            }
        });
    }

    function renderLyrics(lines) {
        elLyricsStream.innerHTML = "";
        lines.forEach((l, idx) => {
            const box = document.createElement("div");
            box.className = "lyric-line-box";
            box.setAttribute("data-idx", idx);
            box.innerHTML = `
                <div class="lyric-main-text">${l.text}</div>
                ${l.trans ? `<div class="lyric-trans-line">${l.trans}</div>` : ""}
            `;
            box.addEventListener("click", (e) => {
                e.stopPropagation();
                Native.seekAudio(Math.floor(l.time * 1000));
            });
            elLyricsStream.appendChild(box);
        });
    }

    function syncLyrics(sec) {
        if (!state.lyrics || state.lyrics.length === 0) return;

        let active = -1;
        for (let i = 0; i < state.lyrics.length; i++) {
            if (state.lyrics[i].time <= sec + 0.3) {
                active = i;
            } else {
                break;
            }
        }

        if (active !== state.activeLyricIndex && active >= 0) {
            state.activeLyricIndex = active;
            const boxes = elLyricsStream.querySelectorAll(".lyric-line-box");
            boxes.forEach((b, idx) => {
                const isActive = (idx === active);
                b.classList.toggle("active", isActive);
                if (isActive) {
                    b.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            });
        }
    }

    // =========================================================================
    // 搜索模块 (Pathfinder searchTracks)
    // =========================================================================
    let searchTimer = null;
    function onSearchChange(val) {
        clearTimeout(searchTimer);
        const q = (val || "").trim();
        const browseSec = document.getElementById("browseAllSection");
        const resultsSec = document.getElementById("searchResultsSection");
        const clearBtn = document.getElementById("btnClearSearch");

        clearBtn.style.display = q ? "block" : "none";

        if (!q) {
            browseSec.style.display = "block";
            resultsSec.style.display = "none";
            return;
        }

        browseSec.style.display = "none";
        resultsSec.style.display = "block";

        const listEl = document.getElementById("searchResultsList");
        listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--sp-text-subdued);font-size:13px;">正在搜索 "${q}"...</div>`;

        searchTimer = setTimeout(() => {
            const vars = {
                searchTerm: q,
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
                    const tracks = items.map(it => parseGqlTrack(it.item ? it.item.data : null)).filter(Boolean);
                    renderTracksList(tracks, listEl);
                } else {
                    listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--sp-text-subdued);font-size:13px;">未检索到相关曲目</div>`;
                }
            });
        }, 320);
    }

    // =========================================================================
    // 全屏播放器交互
    // =========================================================================
    function openFullscreen() {
        elNpFullscreen.classList.add("open");
    }

    function dismissFullscreen() {
        elNpFullscreen.classList.remove("open");
        elNpLyricsCard.classList.remove("expanded");
        elBtnExpandLyrics.textContent = "全屏查看";
    }

    // =========================================================================
    // 初始化事件绑定
    // =========================================================================
    function initEvents() {
        // 底部导航栏切换
        document.querySelectorAll(".nav-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const t = tab.getAttribute("data-tab");
                if (t) switchTab(t);
            });
        });

        // 首页快捷卡片
        document.getElementById("cardLikedSongs").addEventListener("click", () => {
            openPlaylist({ id: "liked", name: "已点赞的歌曲", owner: "我", count: state.likedTracks.length, cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300" });
        });
        document.getElementById("cardDailyMix").addEventListener("click", () => {
            if (FEATURED_TRACKS.length > 0) playTrack(FEATURED_TRACKS[0]);
        });

        // 音乐库我喜欢的歌曲
        document.getElementById("libRowLiked").addEventListener("click", () => {
            openPlaylist({ id: "liked", name: "已点赞的歌曲", owner: "我", count: state.likedTracks.length, cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300" });
        });

        // 顶部设置与返回
        document.getElementById("btnOpenSettings").addEventListener("click", () => switchTab("settings"));
        document.getElementById("btnSettingsBack").addEventListener("click", () => switchTab("home"));
        document.getElementById("btnPlaylistBack").addEventListener("click", () => switchTab("library"));
        document.getElementById("btnSyncLibrary").addEventListener("click", () => syncSpotifyData(true));

        // 迷你播放栏
        elMiniMetaClickArea.addEventListener("click", openFullscreen);
        elMiniCoverImg.addEventListener("click", openFullscreen);
        elMiniBtnPlayPause.addEventListener("click", togglePlay);
        elMiniBtnLike.addEventListener("click", () => toggleLikeTrack(state.currentTrack));

        // 全屏播放器
        elBtnDismissNp.addEventListener("click", dismissFullscreen);
        elNpBtnPlayPause.addEventListener("click", togglePlay);
        elNpBtnLike.addEventListener("click", () => toggleLikeTrack(state.currentTrack));

        elNpBtnPrev.addEventListener("click", () => {
            Native.toast("上一首");
            if (FEATURED_TRACKS.length > 0) playTrack(FEATURED_TRACKS[1]);
        });
        elNpBtnNext.addEventListener("click", () => {
            Native.toast("下一首");
            if (FEATURED_TRACKS.length > 0) playTrack(FEATURED_TRACKS[2]);
        });

        elNpBtnShuffle.addEventListener("click", () => {
            state.shuffle = !state.shuffle;
            elNpBtnShuffle.classList.toggle("active", state.shuffle);
            Native.toast(state.shuffle ? "随机播放开启" : "随机播放关闭");
        });
        elNpBtnRepeat.addEventListener("click", () => {
            state.repeat = !state.repeat;
            elNpBtnRepeat.classList.toggle("active", state.repeat);
            Native.toast(state.repeat ? "单曲循环" : "列表循环");
        });

        // 进度拖动
        elNpScrubRail.addEventListener("click", (e) => {
            const rect = elNpScrubRail.getBoundingClientRect();
            const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            Native.seekAudio(Math.floor(frac * state.duration * 1000));
        });

        // 歌词卡片展开
        elBtnExpandLyrics.addEventListener("click", (e) => {
            e.stopPropagation();
            const isExp = elNpLyricsCard.classList.toggle("expanded");
            elBtnExpandLyrics.textContent = isExp ? "收起" : "全屏查看";
        });
        elNpLyricsCard.addEventListener("click", () => {
            if (!elNpLyricsCard.classList.contains("expanded")) {
                elNpLyricsCard.classList.add("expanded");
                elBtnExpandLyrics.textContent = "收起";
            }
        });

        // 搜索输入
        const searchIn = document.getElementById("searchInput");
        searchIn.addEventListener("input", (e) => onSearchChange(e.target.value));
        document.getElementById("btnClearSearch").addEventListener("click", () => {
            searchIn.value = "";
            onSearchChange("");
        });

        // 歌单全量播放
        document.getElementById("btnPlayAllInHero").addEventListener("click", () => {
            if (state.likedTracks.length > 0) playTrack(state.likedTracks[0]);
        });

        // 设置动作
        document.getElementById("btnActionLogin").addEventListener("click", () => Native.login());
        document.getElementById("btnActionCookieLogin")?.addEventListener("click", () => {
            const spDc = prompt("请输入或粘贴 Spotify 的 sp_dc Cookie 字符串：\n\n【技巧提示】\n1. 若 Google 登录提示浏览器不安全，可在浏览器访问 spotify.com/password-reset 使用 Google 邮箱设置独立密码，即可用邮箱密码直接登录！\n2. 或在手机/电脑浏览器登录 open.spotify.com，在 Cookie 中复制 sp_dc 属性值粘贴于此。");
            if (spDc && spDc.trim()) {
                if (window.AndroidBridge && window.AndroidBridge.setSpDc) {
                    window.AndroidBridge.setSpDc(spDc.trim());
                } else {
                    Native.toast("当前环境不支持保存 Cookie");
                }
            }
        });
        document.getElementById("btnActionSync").addEventListener("click", () => syncSpotifyData(true));
        document.getElementById("btnActionLogout").addEventListener("click", () => {
            Native.logout();
            renderLoggedOutUI();
            Native.toast("已退出登录，恢复访客模式");
        });

        // 代理
        const savedProxy = Native.getProxy();
        if (savedProxy) document.getElementById("inputProxy").value = savedProxy;
        document.getElementById("btnSaveProxy").addEventListener("click", () => {
            const p = document.getElementById("inputProxy").value.trim();
            Native.setProxy(p);
            Native.toast(p ? "已保存代理: " + p : "已恢复系统默认代理");
        });

        // 缓存
        Native.getCacheSize((err, res) => {
            if (!err && res && res.formatted) {
                document.getElementById("settingsCacheDesc").textContent = `已用缓存: ${res.formatted}`;
            }
        });
        document.getElementById("btnClearCache").addEventListener("click", () => {
            Native.clearCache((err, ok) => {
                if (ok) {
                    Native.toast("缓存已成功清除");
                    document.getElementById("settingsCacheDesc").textContent = "已用缓存: 0 B";
                }
            });
        });
    }

    // =========================================================================
    // 渲染推荐卡片与分类网格
    // =========================================================================
    function initUIComponents() {
        // 渲染横向滚动推荐橱窗
        const shelf = document.getElementById("shelfMadeForYou");
        shelf.innerHTML = "";
        FEATURED_TRACKS.forEach(t => {
            const card = document.createElement("div");
            card.className = "shelf-album-card";
            card.innerHTML = `
                <img src="${t.cover}" class="shelf-album-cover" alt="Cover">
                <div class="shelf-album-title">${t.title}</div>
                <div class="shelf-album-sub">${t.artist}</div>
            `;
            card.addEventListener("click", () => playTrack(t));
            shelf.appendChild(card);
        });

        // 渲染首页热门单曲列表
        renderTracksList(FEATURED_TRACKS, document.getElementById("homeTracksList"));

        // 渲染搜索分类网格
        const catGrid = document.getElementById("browseCategoryGrid");
        catGrid.innerHTML = "";
        CATEGORIES.forEach(c => {
            const card = document.createElement("div");
            card.className = "sp-category-card";
            card.style.backgroundColor = c.color;
            card.innerHTML = `
                <span>${c.name}</span>
                <img src="${c.img}" class="cat-bg-img" alt="${c.name}">
            `;
            card.addEventListener("click", () => {
                const searchIn = document.getElementById("searchInput");
                searchIn.value = c.name;
                onSearchChange(c.name);
            });
            catGrid.appendChild(card);
        });
    }

    // 原生回调接入
    window.onPlaybackStateChanged = function (playing) {
        state.isPlaying = playing;
        updatePlayPauseIcons(playing);
    };

    window.onPlaybackProgress = function (currentMs, durationMs) {
        updateProgress(currentMs / 1000, durationMs / 1000);
    };

    window.onNativeLoginSuccess = function (success) {
        if (success) {
            Native.toast("Spotify 登录成功，正在加载数据...");
            syncSpotifyData(true);
        } else {
            renderLoggedOutUI();
        }
    };

    // 启动
    function init() {
        loadUserCache();
        renderAccountUI();
        initEvents();
        initUIComponents();
        syncSpotifyData(false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
