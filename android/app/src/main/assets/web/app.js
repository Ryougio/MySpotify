/**
 * MySpotify Mobile Edition (v0.4.34)
 * 完整对齐 MySpotify 桌面端核心接口 + Spotify Android 原版暗黑美学与交互
 * - Pathfinder GraphQL 全量接口（HomeFeed/Charts/BrowseAll/BrowsePage/ArtistOverview/MultiSearch/RecentlyPlayed/LibraryV3 全量分页）
 * - Android 返回栈导航（返回上一级而非直接退出）
 * - 触控平滑拖拽进度条 + 真实队列上下曲切换
 */

(function () {
    "use strict";

    // =========================================================================
    // 1. Spotify Pathfinder Persisted Query Hashes (同步自 internal/spotify/spotify.go)
    // =========================================================================
    const OPS = {
        profileAttributes:              "08ffb4730af3746e04a8301396f20875dbbce10c75243803091a9274eacc8ac0",
        home:                           "5fb7da7a03ee2776c0670856609cb85a189a3cecc36cc160b91cde79063b9cf1",
        browseAll:                      "dbd8b55e09a58afc52eab438bc228ba28fd72ac2f2148c6c26354980e4579001",
        browsePage:                     "f5c4e6d668f5716464a231c1cc8b22c1cbf6ad68b09929fd7de813a30581298b",
        fetchPlaylist:                  "21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf",
        getAlbum:                       "0b6ce3511e1b02e4a40fa95440f992acbe85080eb308af9194322d708fc1914f",
        libraryV3:                      "390c78e5b951029bad359785e69b07b536a509c581cbcd0aded5e5067f187455",
        fetchLibraryTracks:             "087278b20b743578a6262c2b0b4bcd20d879c503cc359a2285baf083ef944240",
        addToLibrary:                   "896ebcb47815681340860d121cb5d494e157e2a78d3950385cd54e0393c67148",
        removeFromLibrary:              "896ebcb47815681340860d121cb5d494e157e2a78d3950385cd54e0393c67148",
        queryArtistOverview:            "1ac33ddab5d39a3a9c27802774e6d78b9405cc188c6f75aed007df2a32737c72",
        searchTracks:                   "b02683192a98dde7966b5e6655a79eeb62713eab703eda9902c932818dd52751",
        searchArtists:                  "7bf95d754fdbe32c8b161fbbe54d1ae50974900df4dce4c8f1afcbcad153224d",
        searchAlbums:                   "202cb3305e31e5a0767ba7925f28bd728cf8f8b0217e6da43909056071cd70e9",
        searchPlaylists:                "d520014e748f9ea44f7707d8df1819867ac1205e8b7f3e28f22fe5fc858921b1",
        fetchEntitiesForRecentlyPlayed: "cf5d2e94ffd82788470788ae1f6090cc3e9e774fb8fd383580634c6e6f50f7be",
        queryShowMetadataV2:            "b475447846f37cc426add800b995a7859c169c53c72b62de6338c0c40a5dacea",
        queryPodcastEpisodes:           "3539d746cf882f3909660de40b4ef472b3f5893a0761d617c282541de5d412c5"
    };

    const CHARTS_PAGE_URI = "spotify:page:0JQ5DAudkNjCgYMM0TZXDw";
    const CHARTS_FEATURE_SECTION = "spotify:section:0JQ5DAzQHECxDlYNI6xD1g";
    const CHARTS_DAILY_SECTION = "spotify:section:0JQ5DAzQHECxDlYNI6xD1i";
    const CHARTS_FIRST_ORDER = ["全球", "台湾", "香港", "日本", "韩国", "美国", "英国", "新加坡", "马来西亚"];

    const FALLBACK_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23282828'/%3E%3Ccircle cx='150' cy='150' r='55' fill='none' stroke='%23444' stroke-width='8'/%3E%3Ccircle cx='150' cy='150' r='14' fill='%231ed760'/%3E%3C/svg%3E";

    // =========================================================================
    // 2. 应用全局状态
    // =========================================================================
    const state = {
        activeView: "home",
        viewStack: [], // 返回栈，支持逐级返回
        isLoggedIn: false,
        accessToken: "",
        userProfile: null,

        // 首页与发现状态
        homeFacet: "",
        dailyMixUri: "",
        browseCategories: [],
        chartsLoaded: false,

        // 音乐库全量状态
        libFilter: "all",
        likedTracks: [],
        likedTrackIds: new Set(),
        likedTotalCount: 0,
        userPlaylists: [],
        userAlbums: [],
        userArtists: [],

        // 当前详情页上下文
        currentDetailTracks: [],
        currentDetailUri: "",
        currentDetailSaved: false,
        currentArtist: null,

        // 播放器与队列状态
        currentTrack: null,
        queue: [],
        queueIndex: -1,
        playingFromName: "为你推荐",
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        isDraggingScrub: false,
        shuffle: false,
        repeat: false,
        lyrics: [],
        activeLyricIdx: -1
    };

    let cbCounter = 0;

    // =========================================================================
    // 3. 原生 Android 桥接封装
    // =========================================================================
    const Native = {
        toast(msg) {
            if (window.AndroidBridge && window.AndroidBridge.showToast) {
                window.AndroidBridge.showToast(String(msg));
            } else {
                console.log("[Toast]", msg);
            }
        },
        vibrate(ms) {
            if (window.AndroidBridge && window.AndroidBridge.vibrate) {
                window.AndroidBridge.vibrate(ms || 12);
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
        getSavedToken() {
            if (window.AndroidBridge && window.AndroidBridge.getSavedAccessToken) {
                return window.AndroidBridge.getSavedAccessToken() || "";
            }
            return "";
        },
        setProxy(proxy) {
            if (window.AndroidBridge && window.AndroidBridge.setProxy) {
                window.AndroidBridge.setProxy(proxy);
            }
        },
        getProxy() {
            if (window.AndroidBridge && window.AndroidBridge.getProxy) {
                return window.AndroidBridge.getProxy() || "";
            }
            return "";
        },
        fetchAccessToken() {
            return new Promise((resolve, reject) => {
                if (!window.AndroidBridge || !window.AndroidBridge.fetchAccessToken) {
                    return reject(new Error("非 Android 环境"));
                }
                const cbName = "__cb_token_" + (++cbCounter);
                window[cbName] = (err, resStr) => {
                    delete window[cbName];
                    if (err) return reject(new Error(err));
                    try {
                        const data = JSON.parse(resStr);
                        if (data && data.accessToken) {
                            state.accessToken = data.accessToken;
                            resolve(data.accessToken);
                        } else {
                            reject(new Error("Token 返回异常"));
                        }
                    } catch (e) {
                        reject(e);
                    }
                };
                window.AndroidBridge.fetchAccessToken(cbName);
            });
        },
        fetchPathfinder(opName, variables, tokenOverride) {
            return new Promise((resolve, reject) => {
                const hash = OPS[opName];
                if (!hash) return reject(new Error("Unknown op: " + opName));
                if (!window.AndroidBridge || !window.AndroidBridge.fetchPathfinder) {
                    return reject(new Error("非 Android 环境"));
                }
                const cbName = "__cb_pf_" + (++cbCounter);
                window[cbName] = (err, resStr) => {
                    delete window[cbName];
                    if (err) return reject(new Error(err));
                    try {
                        resolve(JSON.parse(resStr));
                    } catch (e) {
                        reject(e);
                    }
                };
                window.AndroidBridge.fetchPathfinder(
                    opName,
                    hash,
                    JSON.stringify(variables || {}),
                    tokenOverride || state.accessToken || "",
                    cbName
                );
            });
        },
        fetchSpClient(path) {
            return new Promise((resolve, reject) => {
                if (!window.AndroidBridge || !window.AndroidBridge.fetchSpClient) {
                    return reject(new Error("不支持 spclient 接口"));
                }
                const cbName = "__cb_sp_" + (++cbCounter);
                window[cbName] = (err, resStr) => {
                    delete window[cbName];
                    if (err) return reject(new Error(err));
                    try {
                        resolve(JSON.parse(resStr));
                    } catch (e) {
                        reject(e);
                    }
                };
                window.AndroidBridge.fetchSpClient(path, state.accessToken || "", cbName);
            });
        },
        resolveAudioUrl(title, artist) {
            return new Promise((resolve, reject) => {
                if (!window.AndroidBridge || !window.AndroidBridge.resolveAudioUrl) {
                    return reject(new Error("无音频解析桥接"));
                }
                const cbName = "__cb_audio_" + (++cbCounter);
                window[cbName] = (err, resStr) => {
                    delete window[cbName];
                    if (err) return reject(new Error(err));
                    try {
                        resolve(JSON.parse(resStr));
                    } catch (e) {
                        reject(e);
                    }
                };
                window.AndroidBridge.resolveAudioUrl(title || "", artist || "", cbName);
            });
        },
        fetchLyrics(trackId, title, artist, durationSec) {
            return new Promise((resolve, reject) => {
                if (!window.AndroidBridge || !window.AndroidBridge.fetchLyrics) {
                    return reject(new Error("无歌词桥接"));
                }
                const cbName = "__cb_lyr_" + (++cbCounter);
                window[cbName] = (err, resStr) => {
                    delete window[cbName];
                    if (err) return reject(new Error(err));
                    try {
                        resolve(JSON.parse(resStr));
                    } catch (e) {
                        reject(e);
                    }
                };
                window.AndroidBridge.fetchLyrics(trackId || "", title || "", artist || "", Math.floor(durationSec || 0), cbName);
            });
        },
        playAudio(url, title, artist, cover) {
            if (window.AndroidBridge && window.AndroidBridge.playAudio) {
                window.AndroidBridge.playAudio(url, title || "", artist || "", cover || "");
            }
        },
        pauseAudio() {
            if (window.AndroidBridge && window.AndroidBridge.pauseAudio) {
                window.AndroidBridge.pauseAudio();
            }
        },
        resumeAudio() {
            if (window.AndroidBridge && window.AndroidBridge.resumeAudio) {
                window.AndroidBridge.resumeAudio();
            }
        },
        seekAudio(posMs) {
            if (window.AndroidBridge && window.AndroidBridge.seekTo) {
                window.AndroidBridge.seekTo(Math.max(0, Math.floor(posMs)));
            }
        },
        getCacheSize(cb) {
            if (!window.AndroidBridge || !window.AndroidBridge.getCacheSize) return cb(null, { formatted: "0 B" });
            const cbName = "__cb_cache_" + (++cbCounter);
            window[cbName] = (err, resStr) => {
                delete window[cbName];
                try { cb(err, resStr ? JSON.parse(resStr) : null); } catch (e) { cb(e); }
            };
            window.AndroidBridge.getCacheSize(cbName);
        },
        clearCache(cb) {
            if (!window.AndroidBridge || !window.AndroidBridge.clearCache) return cb(null);
            const cbName = "__cb_ccache_" + (++cbCounter);
            window[cbName] = (err, resStr) => {
                delete window[cbName];
                cb(err);
            };
            window.AndroidBridge.clearCache(cbName);
        }
    };

    // 确保有可用 Token（登录用户 Token 或访客匿名 Token）
    async function ensureToken(forceRefresh = false) {
        if (!forceRefresh && state.accessToken) return state.accessToken;
        if (!forceRefresh) {
            const saved = Native.getSavedToken();
            if (saved) {
                state.accessToken = saved;
                return saved;
            }
        }
        return await Native.fetchAccessToken();
    }

    // 带自动 Token 刷新的 Pathfinder 查询
    async function gql(opName, variables) {
        await ensureToken(false);
        try {
            return await Native.fetchPathfinder(opName, variables);
        } catch (err) {
            const msg = String(err.message || err);
            if (msg.includes("401") || msg.includes("expired") || msg.includes("Unauthorized")) {
                await ensureToken(true);
                return await Native.fetchPathfinder(opName, variables);
            }
            throw err;
        }
    }

    // =========================================================================
    // 4. Spotify 数据实体解析辅助 (对齐 internal/spotify/catalog.go)
    // =========================================================================
    function bestImage(imgObj) {
        if (!imgObj) return "";
        const sources = imgObj.sources || (imgObj.items && imgObj.items[0] && imgObj.items[0].sources) || [];
        if (!sources.length) return "";
        // 选择中等或高分辨率封面
        let best = sources[0];
        for (const s of sources) {
            if ((s.width || 0) >= (best.width || 0)) best = s;
        }
        return fixImageUrl(best.url || "");
    }

    function fixImageUrl(url) {
        if (!url) return "";
        if (url.startsWith("spotify:mosaic:")) {
            return "https://mosaic.scdn.co/640/" + url.replace("spotify:mosaic:", "").replace(/:/g, "");
        }
        return url;
    }

    function stripHtml(str) {
        if (!str) return "";
        return str.replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, "\"")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">");
    }

    function escapeHtml(s) {
        if (!s) return "";
        return String(s).replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
        }[c]));
    }

    function formatTime(sec) {
        if (!sec || isNaN(sec) || sec < 0) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function formatNumber(n) {
        if (!n) return "0";
        if (n >= 100000000) return (n / 100000000).toFixed(2) + " 亿";
        if (n >= 10000) return (n / 10000).toFixed(1) + " 万";
        return n.toLocaleString();
    }

    function idFromUri(uri) {
        if (!uri) return "";
        const parts = uri.split(":");
        return parts[parts.length - 1] || uri;
    }

    function parseEntity(e) {
        if (!e) return null;
        const t = e.__typename || "";
        const uri = e.uri || e._uri || "";
        if (!uri) return null;

        if (uri === "spotify:collection:tracks" || (t === "PseudoPlaylist" && uri.includes("collection"))) {
            return {
                kind: "liked",
                uri: "spotify:collection:tracks",
                name: "我喜欢的音乐",
                subtitle: "歌单",
                cover: "",
                trackCount: (e.content && e.content.totalCount) || 0
            };
        }

        if (t === "Artist" || uri.startsWith("spotify:artist:")) {
            return {
                kind: "artist",
                uri: uri,
                name: (e.profile && e.profile.name) || e.name || "未知艺人",
                subtitle: "艺人",
                cover: bestImage(e.visuals && e.visuals.avatarImage) || FALLBACK_COVER
            };
        }

        if (t === "Playlist" || uri.startsWith("spotify:playlist:")) {
            const ownerName = (e.ownerV2 && e.ownerV2.data && (e.ownerV2.data.name || e.ownerV2.data.username)) || "Spotify";
            const ownerUser = (e.ownerV2 && e.ownerV2.data && e.ownerV2.data.username) || "";
            return {
                kind: "playlist",
                uri: uri,
                name: e.name || "歌单",
                subtitle: stripHtml(e.description) || ownerName,
                owner: ownerUser,
                ownerName: ownerName,
                cover: bestImage(e.images) || FALLBACK_COVER,
                trackCount: (e.content && e.content.totalCount) || 0
            };
        }

        if (t === "Album" || uri.startsWith("spotify:album:")) {
            const artists = ((e.artists && e.artists.items) || []).map(a => (a.profile && a.profile.name) || a.name).filter(Boolean);
            return {
                kind: "album",
                uri: uri,
                name: e.name || "专辑",
                subtitle: artists.join(", ") || "专辑",
                cover: bestImage(e.coverArt) || FALLBACK_COVER,
                year: (e.date && e.date.year) || ""
            };
        }

        if (t === "Podcast" || uri.startsWith("spotify:show:")) {
            return {
                kind: "show",
                uri: uri,
                name: e.name || "播客",
                subtitle: (e.publisher && e.publisher.name) || "播客节目",
                cover: bestImage(e.coverArt) || FALLBACK_COVER
            };
        }

        return null;
    }

    function parseTrack(t, fallbackAlbum) {
        if (!t) return null;
        const uri = t.uri || t._uri || "";
        const id = idFromUri(uri) || t.id || "";
        if (!t.name) return null;

        const artistsArr = (t.artists && t.artists.items) || [];
        const artistNames = artistsArr.map(a => (a.profile && a.profile.name) || a.name).filter(Boolean);
        const firstArtistUri = (artistsArr[0] && artistsArr[0].uri) || "";

        const albumObj = t.albumOfTrack || fallbackAlbum || {};
        const cover = bestImage(albumObj.coverArt) || (fallbackAlbum && fallbackAlbum.cover) || FALLBACK_COVER;
        const durationMs = (t.duration && t.duration.totalMilliseconds) ||
            (t.trackDuration && t.trackDuration.totalMilliseconds) || 0;

        return {
            id: id,
            uri: uri || (id ? "spotify:track:" + id : ""),
            title: t.name,
            artist: artistNames.join(", ") || (fallbackAlbum && fallbackAlbum.artist) || "未知艺人",
            artistUri: firstArtistUri,
            album: albumObj.name || (fallbackAlbum && fallbackAlbum.name) || "",
            albumUri: albumObj.uri || (fallbackAlbum && fallbackAlbum.uri) || "",
            cover: cover,
            durationMs: durationMs
        };
    }

    // =========================================================================
    // 5. 页面路由与返回栈 (修复问题1：Android 返回键逐级返回)
    // =========================================================================
    const mainScroll = document.getElementById("mainScroll");
    const npFullscreen = document.getElementById("npFullscreen");
    const npLyricsCard = document.getElementById("npLyricsCard");
    const btnExpandLyrics = document.getElementById("btnExpandLyrics");

    const TAB_VIEWS = new Set(["home", "search", "library"]);

    function showView(viewName, pushToStack = true) {
        if (pushToStack && state.activeView && state.activeView !== viewName) {
            state.viewStack.push(state.activeView);
            if (state.viewStack.length > 30) state.viewStack.shift();
        }
        state.activeView = viewName;

        document.querySelectorAll(".sp-tab-view").forEach(el => el.classList.remove("active"));
        const viewId = "view" + viewName.charAt(0).toUpperCase() + viewName.slice(1);
        const target = document.getElementById(viewId);
        if (target) target.classList.add("active");

        // 高亮底部 3-Tab
        if (TAB_VIEWS.has(viewName)) {
            document.querySelectorAll(".nav-tab").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.tab === viewName);
            });
        }

        mainScroll.scrollTop = 0;
    }

    function switchTab(tabName) {
        if (state.activeView === tabName) {
            mainScroll.scrollTop = 0;
            return;
        }
        state.viewStack = [];
        showView(tabName, false);
        if (tabName === "search" && state.browseCategories.length === 0) {
            loadBrowseCategories();
        }
    }

    function goBack() {
        if (state.viewStack.length > 0) {
            const prev = state.viewStack.pop();
            showView(prev, false);
            return true;
        }
        if (!TAB_VIEWS.has(state.activeView)) {
            showView("home", false);
            return true;
        }
        return false;
    }

    // 暴露给 MainActivity.java 的全局返回处理器
    window.handleAndroidBack = function () {
        // 1. 若全屏歌词展开 -> 先收起歌词
        if (npLyricsCard && npLyricsCard.classList.contains("expanded")) {
            npLyricsCard.classList.remove("expanded");
            if (btnExpandLyrics) btnExpandLyrics.textContent = "全屏查看";
            return true;
        }
        // 2. 若全屏播放器打开 -> 先收起播放器
        if (npFullscreen && npFullscreen.classList.contains("open")) {
            npFullscreen.classList.remove("open");
            return true;
        }
        // 3. 若当前在二级页面或有历史栈 -> 返回上一级页面
        if (state.viewStack.length > 0 || !TAB_VIEWS.has(state.activeView)) {
            return goBack();
        }
        // 4. 若在搜索页且已输入搜索词 -> 清空搜索回到浏览全部
        const searchIn = document.getElementById("searchInput");
        if (state.activeView === "search" && searchIn && searchIn.value.trim() !== "") {
            searchIn.value = "";
            onSearchChange("");
            return true;
        }
        // 5. 若在搜索或音乐库根 Tab -> 回到首页 Tab
        if (state.activeView !== "home") {
            switchTab("home");
            return true;
        }
        // 6. 已在首页根视图 -> 交由 Android 双击退出
        return false;
    };

    // =========================================================================
    // 6. 首页 HomeFeed (修复问题3 & 问题5：全部/音乐/播客 + 真实个性化推荐)
    // =========================================================================
    async function loadHomeFeed(facet = "") {
        state.homeFacet = facet;
        const container = document.getElementById("homeDynamicSections");
        const recentsGrid = document.getElementById("homeRecentsGrid");
        container.innerHTML = `<div class="sp-loading-box">正在加载 Spotify ${facet === "podcasts-chip" ? "播客" : facet === "music-chip" ? "音乐" : "为你推荐"}...</div>`;

        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
            const res = await gql("home", {
                timeZone: tz,
                sp_t: "",
                facet: facet,
                sectionItemsLimit: 20,
                homeEndUserIntegration: "INTEGRATION_WEB_PLAYER"
            });

            const homeData = res && res.data && res.data.home;
            const rawSections = (homeData && homeData.sectionContainer && homeData.sectionContainer.sections && homeData.sectionContainer.sections.items) || [];

            let shortcuts = [];
            const shelves = [];
            let forYouUri = "";

            for (const sec of rawSections) {
                const typename = (sec.data && sec.data.__typename) || "";
                const title = (sec.data && sec.data.title && sec.data.title.transformedLabel) || "";
                const rawItems = (sec.sectionItems && sec.sectionItems.items) || [];

                const parsedItems = [];
                const seen = new Set();
                for (const it of rawItems) {
                    const ent = parseEntity(it && it.content && it.content.data);
                    if (ent && !seen.has(ent.uri)) {
                        seen.add(ent.uri);
                        parsedItems.push(ent);
                        if (!state.dailyMixUri && ent.uri.startsWith("spotify:playlist:37i9dQZF1E3")) {
                            state.dailyMixUri = ent.uri;
                        }
                    }
                }
                if (parsedItems.length === 0) continue;

                if (typename === "HomeShortsSectionData") {
                    shortcuts = parsedItems;
                    continue;
                }
                if (sec.uri === "spotify:section:0JQ5DAnM3wGh0gz1MXnu3B" && parsedItems[0] && !forYouUri) {
                    forYouUri = parsedItems[0].uri;
                }
                if (typename === "HomeFeedBaselineSectionData") {
                    const shelfTitle = title || "为你推荐";
                    const existing = shelves.find(s => s.title === shelfTitle);
                    if (existing) {
                        for (const p of parsedItems) {
                            if (!existing.items.some(x => x.uri === p.uri)) existing.items.push(p);
                        }
                    } else {
                        shelves.push({ title: shelfTitle, items: parsedItems });
                    }
                    continue;
                }
                shelves.push({ title: title || "推荐精选", items: parsedItems });
            }

            if (!state.dailyMixUri && forYouUri) {
                state.dailyMixUri = forYouUri;
            }

            // 渲染顶部 2 列快捷网格
            renderHomeShortcuts(recentsGrid, shortcuts);

            // 渲染全部推荐橱窗
            if (shelves.length === 0) {
                container.innerHTML = `<div class="sp-loading-box">${state.isLoggedIn ? "当前分类暂无推荐内容，可点击上方排行榜或浏览探索" : "登录后解锁 Spotify 个性化为你推荐，或点击上方「排行榜 / 浏览」直接探索"}</div>`;
                return;
            }

            container.innerHTML = "";
            for (const shelf of shelves) {
                const secEl = document.createElement("section");
                secEl.className = "sp-shelf-section";
                secEl.innerHTML = `<h2 class="sp-shelf-title">${escapeHtml(shelf.title)}</h2><div class="sp-shelf-scroll"></div>`;
                const scrollEl = secEl.querySelector(".sp-shelf-scroll");
                for (const item of shelf.items) {
                    scrollEl.appendChild(createEntityCard(item));
                }
                container.appendChild(secEl);
            }
        } catch (err) {
            console.warn("HomeFeed error:", err);
            renderHomeShortcuts(recentsGrid, []);
            container.innerHTML = `
                <div class="sp-loading-box">
                    <p style="margin-bottom:12px;">加载首页推荐失败：${escapeHtml(err.message || "网络异常")}</p>
                    <button class="sp-outline-btn" id="btnRetryHome">点击重试</button>
                </div>
            `;
            document.getElementById("btnRetryHome")?.addEventListener("click", () => loadHomeFeed(state.homeFacet));
        }
    }

    function renderHomeShortcuts(gridEl, shortcuts) {
        gridEl.innerHTML = "";
        const items = [];
        // 如果已登录且 shortcuts 中不含「我喜欢的音乐」，置顶添加
        if (state.isLoggedIn && !shortcuts.some(x => x.kind === "liked")) {
            items.push({ kind: "liked", uri: "spotify:collection:tracks", name: "我喜欢的音乐" });
        }
        for (const s of shortcuts) {
            if (items.length < 8) items.push(s);
        }
        // 如果完全为空（未登录或刚进入），补上快捷入口
        if (items.length === 0) {
            items.push({ kind: "liked", uri: "spotify:collection:tracks", name: "我喜欢的音乐" });
            items.push({ kind: "charts_shortcut", name: "全球排行榜" });
        }

        for (const item of items) {
            const card = document.createElement("div");
            card.className = "sp-recent-card";
            if (item.kind === "liked") {
                card.innerHTML = `
                    <div class="recent-cover-box liked-gradient">
                        <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                    </div>
                    <span class="recent-title">我喜欢的音乐</span>
                `;
                card.addEventListener("click", () => openLikedSongsDetail());
            } else if (item.kind === "charts_shortcut") {
                card.innerHTML = `
                    <div class="recent-cover-box daily-gradient">
                        <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                            <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                        </svg>
                    </div>
                    <span class="recent-title">官方排行榜</span>
                `;
                card.addEventListener("click", () => openChartsPage());
            } else {
                card.innerHTML = `
                    <img src="${escapeHtml(item.cover || FALLBACK_COVER)}" class="recent-cover-img" alt="">
                    <span class="recent-title">${escapeHtml(item.name)}</span>
                `;
                card.addEventListener("click", () => openEntity(item));
            }
            gridEl.appendChild(card);
        }
    }

    function createEntityCard(item) {
        if (item.kind === "artist") {
            const card = document.createElement("div");
            card.className = "sp-artist-card";
            card.innerHTML = `
                <img src="${escapeHtml(item.cover || FALLBACK_COVER)}" class="sp-artist-avatar" alt="">
                <div class="sp-artist-name">${escapeHtml(item.name)}</div>
                <div class="sp-artist-tag">艺人</div>
            `;
            card.addEventListener("click", () => openArtistPage(item.uri, item.name, item.cover));
            return card;
        }
        const card = document.createElement("div");
        card.className = "sp-shelf-card";
        card.innerHTML = `
            <img src="${escapeHtml(item.cover || FALLBACK_COVER)}" class="shelf-card-cover" alt="">
            <div class="shelf-card-title">${escapeHtml(item.name)}</div>
            <div class="shelf-card-sub">${escapeHtml(item.subtitle || "")}</div>
        `;
        card.addEventListener("click", () => openEntity(item));
        return card;
    }

    function openEntity(item) {
        if (!item) return;
        if (item.kind === "liked" || item.uri === "spotify:collection:tracks") {
            openLikedSongsDetail();
        } else if (item.kind === "artist" || (item.uri && item.uri.startsWith("spotify:artist:"))) {
            openArtistPage(item.uri, item.name, item.cover);
        } else if (item.kind === "album" || (item.uri && item.uri.startsWith("spotify:album:"))) {
            openAlbumDetail(item.uri, item.name, item.cover);
        } else if (item.kind === "show" || (item.uri && item.uri.startsWith("spotify:show:"))) {
            openShowDetail(item.uri, item.name, item.cover);
        } else if (item.uri && item.uri.startsWith("spotify:playlist:")) {
            openPlaylistDetail(item.uri, item.name, item.cover);
        }
    }

    // =========================================================================
    // 7. 排行榜页 Charts (对齐桌面端 internal/spotify/catalog.go:Charts)
    // =========================================================================
    async function openChartsPage() {
        showView("charts", true);
        const featEl = document.getElementById("chartsFeaturedList");
        const regGrid = document.getElementById("chartsRegionalGrid");
        const regTitle = document.getElementById("chartsRegionalTitle");

        featEl.innerHTML = `<div class="sp-loading-box">正在加载 Spotify 官方排行榜...</div>`;
        regGrid.innerHTML = "";
        regTitle.style.display = "none";

        try {
            const res = await gql("browsePage", {
                uri: CHARTS_PAGE_URI,
                pagePagination: { offset: 0, limit: 10 },
                sectionPagination: { offset: 0, limit: 80 },
                browseEndUserIntegration: "INTEGRATION_WEB_PLAYER"
            });

            const sections = (res && res.data && res.data.browse && res.data.browse.sections && res.data.browse.sections.items) || [];
            const featured = [];
            const daily = [];
            const seen = new Set();

            for (const sec of sections) {
                const isFeat = sec.uri === CHARTS_FEATURE_SECTION;
                const isDaily = sec.uri === CHARTS_DAILY_SECTION;
                for (const it of (sec.sectionItems && sec.sectionItems.items) || []) {
                    const ent = parseEntity(it && it.content && it.content.data);
                    if (!ent || ent.kind !== "playlist" || seen.has(ent.uri)) continue;
                    seen.add(ent.uri);
                    if (isFeat) featured.push(ent);
                    else if (isDaily) daily.push(ent);
                    else daily.push(ent);
                }
            }

            // 按桌面端顺序优先排列热门地区（全球/台湾/香港/日本/韩国/美国/英国...）
            const rankOf = (name) => {
                for (let i = 0; i < CHARTS_FIRST_ORDER.length; i++) {
                    if (name.includes(CHARTS_FIRST_ORDER[i])) return i;
                }
                return CHARTS_FIRST_ORDER.length;
            };
            daily.sort((a, b) => rankOf(a.name) - rankOf(b.name));

            featEl.innerHTML = "";
            if (featured.length > 0) {
                for (const pl of featured) {
                    const card = document.createElement("div");
                    card.className = "chart-feature-card";
                    card.innerHTML = `
                        <img src="${escapeHtml(pl.cover)}" class="chart-feature-cover" alt="">
                        <div class="chart-feature-info">
                            <div class="chart-feature-title">${escapeHtml(pl.name)}</div>
                            <div class="chart-feature-sub">${escapeHtml(pl.subtitle || "Spotify 官方榜单")}</div>
                        </div>
                    `;
                    card.addEventListener("click", () => openPlaylistDetail(pl.uri, pl.name, pl.cover));
                    featEl.appendChild(card);
                }
            } else if (daily.length === 0) {
                featEl.innerHTML = `<div class="sp-loading-box">暂无榜单数据，请检查网络连接</div>`;
            }

            if (daily.length > 0) {
                regTitle.style.display = "block";
                for (const pl of daily) {
                    const card = document.createElement("div");
                    card.className = "chart-grid-card";
                    card.innerHTML = `
                        <img src="${escapeHtml(pl.cover)}" class="chart-grid-cover" alt="">
                        <div class="chart-grid-title">${escapeHtml(pl.name)}</div>
                        <div class="chart-grid-sub">Spotify</div>
                    `;
                    card.addEventListener("click", () => openPlaylistDetail(pl.uri, pl.name, pl.cover));
                    regGrid.appendChild(card);
                }
            }
        } catch (err) {
            featEl.innerHTML = `<div class="sp-loading-box">加载排行榜失败：${escapeHtml(err.message)}</div>`;
        }
    }

    // =========================================================================
    // 8. 最近播放页 Recently Played (对齐 internal/spotify/recent.go)
    // =========================================================================
    async function openRecentPage() {
        showView("recent", true);
        const wrap = document.getElementById("recentContentWrap");
        if (!state.isLoggedIn || !state.userProfile || !state.userProfile.username) {
            wrap.innerHTML = `<div class="sp-loading-box">请先登录 Spotify 账号后查看最近播放记录</div>`;
            return;
        }
        wrap.innerHTML = `<div class="sp-loading-box">正在同步 Spotify 最近播放...</div>`;

        try {
            const username = encodeURIComponent(state.userProfile.username);
            const raw = await Native.fetchSpClient(`/recently-played/v3/user/${username}/recently-played?format=json&offset=0&limit=50&filter=default,collection-new-episodes`);
            const uris = ((raw && raw.playContexts) || []).map(c => c.uri).filter(Boolean);
            if (uris.length === 0) {
                wrap.innerHTML = `<div class="sp-loading-box">最近暂无播放记录</div>`;
                return;
            }
            const res = await gql("fetchEntitiesForRecentlyPlayed", { uris });
            const lookups = (res && res.data && res.data.lookup) || [];

            const artists = [];
            const lists = [];
            const seen = new Set();
            for (const l of lookups) {
                const ent = parseEntity(l && l.data);
                if (!ent || seen.has(ent.uri)) continue;
                seen.add(ent.uri);
                if (ent.kind === "artist") artists.push(ent);
                else lists.push(ent);
            }

            wrap.innerHTML = "";
            if (artists.length > 0) {
                const sec = document.createElement("section");
                sec.className = "sp-shelf-section";
                sec.innerHTML = `<h2 class="sp-shelf-title">最近常听艺人</h2><div class="sp-shelf-scroll"></div>`;
                const sc = sec.querySelector(".sp-shelf-scroll");
                artists.forEach(a => sc.appendChild(createEntityCard(a)));
                wrap.appendChild(sec);
            }
            if (lists.length > 0) {
                const sec = document.createElement("section");
                sec.className = "sp-shelf-section";
                sec.innerHTML = `<h2 class="sp-shelf-title">最近播放的歌单与专辑</h2><div class="charts-regional-grid"></div>`;
                const grid = sec.querySelector(".charts-regional-grid");
                for (const pl of lists) {
                    const card = document.createElement("div");
                    card.className = "chart-grid-card";
                    card.innerHTML = `
                        <img src="${escapeHtml(pl.cover || FALLBACK_COVER)}" class="chart-grid-cover" alt="">
                        <div class="chart-grid-title">${escapeHtml(pl.name)}</div>
                        <div class="chart-grid-sub">${escapeHtml(pl.subtitle || "")}</div>
                    `;
                    card.addEventListener("click", () => openEntity(pl));
                    grid.appendChild(card);
                }
                wrap.appendChild(sec);
            }
            if (artists.length === 0 && lists.length === 0) {
                wrap.innerHTML = `<div class="sp-loading-box">最近暂无播放记录</div>`;
            }
        } catch (err) {
            wrap.innerHTML = `<div class="sp-loading-box">获取最近播放失败：${escapeHtml(err.message)}</div>`;
        }
    }

    // =========================================================================
    // 9. 浏览全部 BrowseAll & 分类推荐歌单 BrowsePage (修复问题4)
    // =========================================================================
    async function loadBrowseCategories() {
        const grid = document.getElementById("browseCategoryGrid");
        grid.innerHTML = `<div class="sp-loading-box" style="grid-column:span 2;">正在加载 Spotify 全部音乐分类...</div>`;
        try {
            const res = await gql("browseAll", {
                pagePagination: { offset: 0, limit: 10 },
                sectionPagination: { offset: 0, limit: 99 },
                browseEndUserIntegration: "INTEGRATION_WEB_PLAYER"
            });

            const sections = (res && res.data && res.data.browseStart && res.data.browseStart.sections && res.data.browseStart.sections.items) || [];
            const cats = [];
            const seen = new Set();

            for (const sec of sections) {
                for (const it of (sec.sectionItems && sec.sectionItems.items) || []) {
                    const uri = it.uri || "";
                    const data = it.content && it.content.data;
                    const card = data && data.data && data.data.cardRepresentation;
                    const name = card && card.title && card.title.transformedLabel;
                    if (uri.startsWith("spotify:page:") && name && !seen.has(name)) {
                        seen.add(name);
                        cats.push({
                            uri: uri,
                            name: name,
                            color: (card.backgroundColor && card.backgroundColor.hex) || "#503750",
                            image: bestImage(card.artwork) || ""
                        });
                    }
                }
            }

            state.browseCategories = cats;
            grid.innerHTML = "";
            if (cats.length === 0) {
                grid.innerHTML = `<div class="sp-loading-box" style="grid-column:span 2;">暂无分类数据</div>`;
                return;
            }

            for (const cat of cats) {
                const card = document.createElement("div");
                card.className = "sp-cat-card";
                card.style.background = cat.color;
                card.innerHTML = `
                    <span class="cat-title">${escapeHtml(cat.name)}</span>
                    ${cat.image ? `<img src="${escapeHtml(cat.image)}" class="cat-img" alt="">` : ""}
                `;
                // 关键修复：点击分类进入该类型的歌单推荐页，而不是跳转搜索！
                card.addEventListener("click", () => openCategoryPage(cat.uri, cat.name, cat.color));
                grid.appendChild(card);
            }
        } catch (err) {
            grid.innerHTML = `<div class="sp-loading-box" style="grid-column:span 2;">加载分类失败：${escapeHtml(err.message)}</div>`;
        }
    }

    async function openCategoryPage(uri, title, color) {
        showView("category", true);
        document.getElementById("categoryNavTitle").textContent = title || "浏览";
        document.getElementById("categoryHeroTitle").textContent = title || "浏览";
        const banner = document.getElementById("categoryHeroBanner");
        banner.style.background = `linear-gradient(180deg, ${color || "#4b2369"} 0%, #121212 100%)`;

        const container = document.getElementById("categoryShelvesContainer");
        container.innerHTML = `<div class="sp-loading-box">正在加载「${escapeHtml(title)}」精选歌单...</div>`;

        try {
            const res = await gql("browsePage", {
                uri: uri,
                pagePagination: { offset: 0, limit: 10 },
                sectionPagination: { offset: 0, limit: 20 },
                browseEndUserIntegration: "INTEGRATION_WEB_PLAYER"
            });

            const browse = res && res.data && res.data.browse;
            const headerName = browse && browse.header && browse.header.title && browse.header.title.transformedLabel;
            const headerColor = browse && browse.header && browse.header.color && browse.header.color.hex;
            if (headerName) {
                document.getElementById("categoryNavTitle").textContent = headerName;
                document.getElementById("categoryHeroTitle").textContent = headerName;
            }
            if (headerColor) {
                banner.style.background = `linear-gradient(180deg, ${headerColor} 0%, #121212 100%)`;
            }

            const sections = (browse && browse.sections && browse.sections.items) || [];
            container.innerHTML = "";
            let count = 0;

            for (const sec of sections) {
                const secTitle = (sec.data && sec.data.title && sec.data.title.transformedLabel) || "精选推荐";
                const rawItems = (sec.sectionItems && sec.sectionItems.items) || [];

                const lists = [];
                const subTiles = [];
                for (const it of rawItems) {
                    const itemUri = it.uri || "";
                    const d = it.content && it.content.data;
                    const cardRep = d && d.data && d.data.cardRepresentation;
                    if (itemUri.startsWith("spotify:page:") && cardRep && cardRep.title && cardRep.title.transformedLabel) {
                        subTiles.push({
                            uri: itemUri,
                            name: cardRep.title.transformedLabel,
                            color: (cardRep.backgroundColor && cardRep.backgroundColor.hex) || "#3a3a3a",
                            image: bestImage(cardRep.artwork) || ""
                        });
                    } else {
                        const ent = parseEntity(d);
                        if (ent) lists.push(ent);
                    }
                }

                if (lists.length > 0) {
                    count++;
                    const secEl = document.createElement("section");
                    secEl.className = "sp-shelf-section";
                    secEl.innerHTML = `<h2 class="sp-shelf-title">${escapeHtml(secTitle)}</h2><div class="sp-shelf-scroll"></div>`;
                    const sc = secEl.querySelector(".sp-shelf-scroll");
                    lists.forEach(item => sc.appendChild(createEntityCard(item)));
                    container.appendChild(secEl);
                }

                if (subTiles.length > 0) {
                    count++;
                    const secEl = document.createElement("section");
                    secEl.className = "sp-shelf-section";
                    secEl.innerHTML = `<h2 class="sp-shelf-title">${escapeHtml(secTitle)}</h2><div class="sp-category-grid" style="padding:0 16px;"></div>`;
                    const grid = secEl.querySelector(".sp-category-grid");
                    for (const t of subTiles) {
                        const tileEl = document.createElement("div");
                        tileEl.className = "sp-cat-card";
                        tileEl.style.background = t.color;
                        tileEl.innerHTML = `
                            <span class="cat-title">${escapeHtml(t.name)}</span>
                            ${t.image ? `<img src="${escapeHtml(t.image)}" class="cat-img" alt="">` : ""}
                        `;
                        tileEl.addEventListener("click", () => openCategoryPage(t.uri, t.name, t.color));
                        grid.appendChild(tileEl);
                    }
                    container.appendChild(secEl);
                }
            }

            if (count === 0) {
                container.innerHTML = `<div class="sp-loading-box">该分类暂无歌单内容</div>`;
            }
        } catch (err) {
            container.innerHTML = `<div class="sp-loading-box">加载分类失败：${escapeHtml(err.message)}</div>`;
        }
    }

    // =========================================================================
    // 10. 多维度搜索 (修复问题4：艺人圆形头像 + 专辑 + 歌单 + 歌曲)
    // =========================================================================
    let searchTimer = null;
    function onSearchChange(val) {
        const q = (val || "").trim();
        document.getElementById("btnClearSearch").style.display = q ? "block" : "none";
        document.getElementById("browseAllSection").style.display = q ? "none" : "block";
        document.getElementById("searchResultsSection").style.display = q ? "block" : "none";

        if (!q) return;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => executeMultiSearch(q), 400);
    }

    async function executeMultiSearch(q) {
        const loadingHint = document.getElementById("searchLoadingHint");
        const bArtists = document.getElementById("searchArtistsBlock");
        const bAlbums = document.getElementById("searchAlbumsBlock");
        const bPlaylists = document.getElementById("searchPlaylistsBlock");
        const bTracks = document.getElementById("searchTracksBlock");

        loadingHint.style.display = "block";
        loadingHint.textContent = `正在搜索 “${q}” ...`;
        bArtists.style.display = "none";
        bAlbums.style.display = "none";
        bPlaylists.style.display = "none";
        bTracks.style.display = "none";

        const commonVars = {
            searchTerm: q,
            offset: 0,
            limit: 12,
            numberOfTopResults: 5,
            includeAudiobooks: false,
            includePreReleases: false,
            includeAuthors: false
        };

        try {
            const [resArtists, resAlbums, resPlaylists, resTracks] = await Promise.allSettled([
                gql("searchArtists", commonVars),
                gql("searchAlbums", commonVars),
                gql("searchPlaylists", commonVars),
                gql("searchTracks", { ...commonVars, limit: 25 })
            ]);

            loadingHint.style.display = "none";
            let anyResult = false;

            // 1. 艺人 (圆形头像卡片 -> 点击进入艺人主页)
            if (resArtists.status === "fulfilled") {
                const items = (resArtists.value?.data?.searchV2?.artists?.items) || [];
                const listEl = document.getElementById("searchArtistsList");
                listEl.innerHTML = "";
                const artists = items.map(it => parseEntity(it.data)).filter(Boolean);
                if (artists.length > 0) {
                    anyResult = true;
                    bArtists.style.display = "block";
                    artists.forEach(a => listEl.appendChild(createEntityCard(a)));
                }
            }

            // 2. 专辑
            if (resAlbums.status === "fulfilled") {
                const items = (resAlbums.value?.data?.searchV2?.albumsV2?.items) || [];
                const listEl = document.getElementById("searchAlbumsList");
                listEl.innerHTML = "";
                const albums = items.map(it => parseEntity(it.data)).filter(Boolean);
                if (albums.length > 0) {
                    anyResult = true;
                    bAlbums.style.display = "block";
                    albums.forEach(a => listEl.appendChild(createEntityCard(a)));
                }
            }

            // 3. 歌单
            if (resPlaylists.status === "fulfilled") {
                const items = (resPlaylists.value?.data?.searchV2?.playlists?.items) || [];
                const listEl = document.getElementById("searchPlaylistsList");
                listEl.innerHTML = "";
                const playlists = items.map(it => parseEntity(it.data)).filter(Boolean);
                if (playlists.length > 0) {
                    anyResult = true;
                    bPlaylists.style.display = "block";
                    playlists.forEach(p => listEl.appendChild(createEntityCard(p)));
                }
            }

            // 4. 歌曲
            if (resTracks.status === "fulfilled") {
                const items = (resTracks.value?.data?.searchV2?.tracksV2?.items) || [];
                const tracks = items.map(it => parseTrack(it?.item?.data)).filter(Boolean);
                if (tracks.length > 0) {
                    anyResult = true;
                    bTracks.style.display = "block";
                    renderTracksToElement(document.getElementById("searchTracksList"), tracks, `搜索：${q}`);
                }
            }

            if (!anyResult) {
                loadingHint.style.display = "block";
                loadingHint.textContent = `未找到与 “${q}” 相关的结果`;
            }
        } catch (err) {
            loadingHint.style.display = "block";
            loadingHint.textContent = "搜索失败：" + (err.message || "网络异常");
        }
    }

    // =========================================================================
    // 11. 艺人主页 Artist Profile (关注/取消关注 + 热门歌曲 + 专辑 + 相关艺人)
    // =========================================================================
    async function openArtistPage(uri, fallbackName, fallbackAvatar) {
        showView("artist", true);
        state.currentArtist = { uri, name: fallbackName || "艺人", followed: false, topTracks: [] };

        document.getElementById("artistNavTitle").textContent = fallbackName || "艺人";
        document.getElementById("artistHeroName").textContent = fallbackName || "艺人";
        document.getElementById("artistHeroAvatar").src = fallbackAvatar || FALLBACK_COVER;
        document.getElementById("artistHeroBackdrop").style.backgroundImage = fallbackAvatar ? `url('${fallbackAvatar}')` : "none";
        document.getElementById("artistHeroStats").textContent = "正在加载艺人主页...";
        document.getElementById("artistVerifiedBadge").style.display = "none";
        updateFollowBtnUI(false);

        document.getElementById("artistTopTracksList").innerHTML = `<div class="sp-loading-box">正在获取热门歌曲...</div>`;
        document.getElementById("artistAlbumsSec").style.display = "none";
        document.getElementById("artistRelatedSec").style.display = "none";

        try {
            const res = await gql("queryArtistOverview", { uri: uri, locale: "" });
            const au = res && res.data && res.data.artistUnion;
            if (!au) throw new Error("艺人数据为空");

            const name = (au.profile && au.profile.name) || fallbackName || "艺人";
            const verified = Boolean(au.profile && au.profile.verified);
            const avatar = bestImage(au.visuals && au.visuals.avatarImage) || fallbackAvatar || FALLBACK_COVER;
            const banner = bestImage(au.headerImage && au.headerImage.data) || avatar;
            const monthly = (au.stats && au.stats.monthlyListeners) || 0;
            const followers = (au.stats && au.stats.followers) || 0;
            const followed = Boolean(au.saved);

            document.getElementById("artistNavTitle").textContent = name;
            document.getElementById("artistHeroName").textContent = name;
            document.getElementById("artistHeroAvatar").src = avatar;
            document.getElementById("artistHeroBackdrop").style.backgroundImage = `url('${banner}')`;
            document.getElementById("artistVerifiedBadge").style.display = verified ? "inline-flex" : "none";
            document.getElementById("artistHeroStats").textContent =
                `${formatNumber(monthly)} 月度听众 · ${formatNumber(followers)} 位关注者`;
            updateFollowBtnUI(followed);

            // 热门歌曲
            const topRaw = (au.discography && au.discography.topTracks && au.discography.topTracks.items) || [];
            const topTracks = topRaw.map(it => parseTrack(it && it.track)).filter(Boolean);
            state.currentArtist = { uri, name, avatar, followed, topTracks };

            if (topTracks.length > 0) {
                renderTracksToElement(document.getElementById("artistTopTracksList"), topTracks, name);
            } else {
                document.getElementById("artistTopTracksList").innerHTML = `<div class="sp-loading-box">暂无热门歌曲</div>`;
            }

            // 热门发行 / 专辑
            const disc = au.discography || {};
            const releases = [];
            const seenRel = new Set();
            const collectReleases = (group) => {
                if (!group || !group.items) return;
                for (const it of group.items) {
                    const r = (it.releases && it.releases.items && it.releases.items[0]) || it;
                    if (r && r.uri && !seenRel.has(r.uri)) {
                        seenRel.add(r.uri);
                        releases.push({
                            kind: "album",
                            uri: r.uri,
                            name: r.name || "专辑",
                            subtitle: `${(r.date && r.date.year) || ""}${r.type ? " · " + r.type : ""}`,
                            cover: bestImage(r.coverArt) || FALLBACK_COVER
                        });
                    }
                }
            };
            collectReleases(disc.popularReleasesAlbums);
            collectReleases(disc.albums);
            collectReleases(disc.singles);

            if (releases.length > 0) {
                document.getElementById("artistAlbumsSec").style.display = "block";
                const albList = document.getElementById("artistAlbumsList");
                albList.innerHTML = "";
                releases.slice(0, 20).forEach(r => albList.appendChild(createEntityCard(r)));
            }

            // 粉丝也喜欢（相关艺人）
            const relatedRaw = (au.relatedContent && au.relatedContent.relatedArtists && au.relatedContent.relatedArtists.items) || [];
            const related = relatedRaw.map(a => parseEntity({ ...a, __typename: "Artist" })).filter(Boolean);
            if (related.length > 0) {
                document.getElementById("artistRelatedSec").style.display = "block";
                const relList = document.getElementById("artistRelatedList");
                relList.innerHTML = "";
                related.forEach(a => relList.appendChild(createEntityCard(a)));
            }
        } catch (err) {
            document.getElementById("artistHeroStats").textContent = "加载失败：" + (err.message || "");
        }
    }

    function updateFollowBtnUI(following) {
        const btn = document.getElementById("btnArtistFollow");
        if (!btn) return;
        btn.classList.toggle("following", following);
        btn.textContent = following ? "已关注 ✓" : "关注";
    }

    async function toggleArtistFollow() {
        if (!state.currentArtist || !state.currentArtist.uri) return;
        if (!state.isLoggedIn) {
            Native.toast("请先登录 Spotify 账号后再关注艺人");
            return;
        }
        const nextFollow = !state.currentArtist.followed;
        const op = nextFollow ? "addToLibrary" : "removeFromLibrary";
        try {
            await gql(op, { libraryItemUris: [state.currentArtist.uri] });
            state.currentArtist.followed = nextFollow;
            updateFollowBtnUI(nextFollow);
            Native.toast(nextFollow ? `已关注 ${state.currentArtist.name}` : `已取消关注 ${state.currentArtist.name}`);
            // 同步更新本地音乐库关注艺人列表
            if (nextFollow) {
                if (!state.userArtists.some(a => a.uri === state.currentArtist.uri)) {
                    state.userArtists.unshift({
                        kind: "artist",
                        uri: state.currentArtist.uri,
                        name: state.currentArtist.name,
                        subtitle: "艺人",
                        cover: state.currentArtist.avatar || FALLBACK_COVER
                    });
                }
            } else {
                state.userArtists = state.userArtists.filter(a => a.uri !== state.currentArtist.uri);
            }
            renderLibraryView();
        } catch (err) {
            Native.toast("操作失败：" + (err.message || "网络错误"));
        }
    }

    // =========================================================================
    // 12. 完整同步音乐库与全量分页 (修复问题3 & 问题6：歌曲不全、专辑/艺人无反应)
    // =========================================================================
    async function syncSpotifyData(showToast = false) {
        const status = Native.getLoginStatus();
        state.isLoggedIn = Boolean(status.isLoggedIn);

        if (!state.isLoggedIn) {
            renderLoggedOutUI();
            // 即使未登录，也获取匿名访客 Token 加载真实的 Spotify 首页与分类！
            try {
                await ensureToken(false);
                loadHomeFeed(state.homeFacet);
            } catch (e) {
                console.warn("Guest token failed:", e);
            }
            return;
        }

        if (showToast) Native.toast("正在全量同步 Spotify 资料与歌单...");

        try {
            await ensureToken(false);

            // 1. 获取用户资料
            const profRes = await gql("profileAttributes", {});
            const prof = profRes?.data?.me?.profile;
            if (prof) {
                state.userProfile = prof;
                renderProfileUI(prof);
            }

            // 2. 并行拉取首页 + 音乐库全量分页
            const homePromise = loadHomeFeed(state.homeFacet);
            await syncFullLibraryV3();
            await syncAllLikedTracks();
            await homePromise;

            if (showToast) {
                Native.toast(`同步完成：${state.likedTracks.length} 首喜欢 · ${state.userPlaylists.length} 歌单 · ${state.userAlbums.length} 专辑 · ${state.userArtists.length} 艺人`);
            }
        } catch (err) {
            console.error("Sync failed:", err);
            if (showToast) Native.toast("同步异常：" + (err.message || "请检查网络或代理"));
        }
    }

    // 分页拉取全部 libraryV3（包含歌单、专辑、关注艺人）
    async function syncFullLibraryV3() {
        const playlists = [];
        const albums = [];
        const artists = [];
        const seen = new Set();
        let offset = 0;

        while (offset < 2000) {
            const res = await gql("libraryV3", {
                filters: [],
                order: null,
                textFilter: "",
                features: ["LIKED_SONGS"],
                limit: 50,
                offset: offset,
                flatten: true,
                expandedFolders: [],
                folderUri: null,
                includeFoldersWhenFlattening: false
            });

            const lib = res?.data?.me?.libraryV3;
            const items = (lib && lib.items) || [];
            const total = (lib && lib.totalCount) || 0;

            for (const it of items) {
                const raw = it?.item?.data;
                const ent = parseEntity(raw);
                if (!ent || seen.has(ent.uri)) continue;
                seen.add(ent.uri);

                if (ent.kind === "liked") {
                    state.likedTotalCount = ent.trackCount || state.likedTotalCount;
                } else if (ent.kind === "artist") {
                    artists.push(ent);
                } else if (ent.kind === "album") {
                    albums.push(ent);
                } else if (ent.kind === "playlist" || ent.kind === "show") {
                    playlists.push(ent);
                }
            }

            offset += items.length;
            if (items.length === 0 || offset >= total) break;
        }

        state.userPlaylists = playlists;
        state.userAlbums = albums;
        state.userArtists = artists;
        renderLibraryView();
    }

    // 分页拉取全部「我喜欢的音乐」(解决歌曲同步不全的问题)
    async function syncAllLikedTracks() {
        const allTracks = [];
        const ids = new Set();
        let offset = 0;
        const limit = 50;

        while (offset < 2500) {
            const res = await gql("fetchLibraryTracks", { offset, limit });
            const items = res?.data?.me?.library?.tracks?.items || [];
            for (const it of items) {
                const trData = it?.track?.data;
                if (trData && !trData.uri && it?.track?._uri) trData.uri = it.track._uri;
                const parsed = parseTrack(trData);
                if (parsed) {
                    allTracks.push(parsed);
                    if (parsed.id) ids.add(parsed.id);
                }
            }

            // 边分页边更新计数，避免大歌单等待期间显示 0 首
            state.likedTracks = allTracks;
            state.likedTrackIds = ids;
            const countEl = document.getElementById("libLikedCountText");
            if (countEl) {
                const totalDisplay = Math.max(allTracks.length, state.likedTotalCount || 0);
                countEl.textContent = `📌 歌单 · ${totalDisplay} 首歌曲`;
            }

            offset += items.length;
            if (items.length < limit) break;
        }

        state.likedTotalCount = allTracks.length;
        const countEl = document.getElementById("libLikedCountText");
        if (countEl) countEl.textContent = `📌 歌单 · ${allTracks.length} 首歌曲`;
    }

    function renderProfileUI(prof) {
        const name = prof.name || prof.username || "Spotify 用户";
        const avatar = prof.avatar?.sources?.[0]?.url || "";
        const initial = name.charAt(0).toUpperCase();

        document.querySelectorAll(".user-avatar-text").forEach(el => {
            if (avatar) {
                el.parentElement.innerHTML = `<img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                el.textContent = initial;
            }
        });

        const settingsAvatar = document.getElementById("settingsUserAvatar");
        if (settingsAvatar) {
            settingsAvatar.innerHTML = avatar
                ? `<img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : `<span class="avatar-letter">${escapeHtml(initial)}</span>`;
        }
        document.getElementById("settingsAccountName").textContent = name;
        document.getElementById("settingsAccountEmail").textContent = "@" + (prof.username || "spotify");
        document.getElementById("settingsAccountTier").textContent = "Spotify 已登录";
        document.getElementById("rowLogin").style.display = "none";
        document.getElementById("rowSync").style.display = "flex";
        document.getElementById("rowLogout").style.display = "flex";
    }

    function renderLoggedOutUI() {
        state.isLoggedIn = false;
        state.userProfile = null;
        state.likedTracks = [];
        state.likedTrackIds.clear();
        state.userPlaylists = [];
        state.userAlbums = [];
        state.userArtists = [];

        document.getElementById("settingsAccountName").textContent = "未登录 (访客模式)";
        document.getElementById("settingsAccountEmail").textContent = "登录 Spotify 同步个人音乐库";
        document.getElementById("settingsAccountTier").textContent = "免费访客";
        document.getElementById("rowLogin").style.display = "flex";
        document.getElementById("rowSync").style.display = "none";
        document.getElementById("rowLogout").style.display = "none";
        document.getElementById("libLikedCountText").textContent = "📌 歌单 · 请登录同步";
        renderLibraryView();
    }

    // 渲染音乐库 (支持 全部 / 播放列表 / 专辑 / 艺人 完整切换)
    function renderLibraryView() {
        const filter = state.libFilter || "all";
        const likedRow = document.getElementById("libRowLiked");
        const container = document.getElementById("libraryPlaylistsContainer");
        const summary = document.getElementById("libSummaryLabel");

        if (likedRow) {
            likedRow.style.display = (filter === "all" || filter === "playlists") ? "flex" : "none";
        }

        let itemsToRender = [];
        if (filter === "playlists") {
            itemsToRender = state.userPlaylists;
            if (summary) summary.querySelector("span").textContent = `播放列表 (${state.userPlaylists.length})`;
        } else if (filter === "albums") {
            itemsToRender = state.userAlbums;
            if (summary) summary.querySelector("span").textContent = `已收藏专辑 (${state.userAlbums.length})`;
        } else if (filter === "artists") {
            itemsToRender = state.userArtists;
            if (summary) summary.querySelector("span").textContent = `已关注艺人 (${state.userArtists.length})`;
        } else {
            itemsToRender = [...state.userPlaylists, ...state.userAlbums, ...state.userArtists];
            if (summary) summary.querySelector("span").textContent = `全部收藏 (${itemsToRender.length})`;
        }

        container.innerHTML = "";
        if (itemsToRender.length === 0) {
            const emptyHint = !state.isLoggedIn
                ? "请点击首页右上角设置登录 Spotify 账号"
                : filter === "albums" ? "你还没有收藏任何专辑"
                : filter === "artists" ? "你还没有关注任何艺人"
                : "暂无播放列表";
            container.innerHTML = `<div class="sp-loading-box">${emptyHint}</div>`;
            return;
        }

        for (const item of itemsToRender) {
            const row = document.createElement("div");
            row.className = "sp-library-row";
            const isArtist = item.kind === "artist";
            const typeLabel = isArtist ? "艺人" : item.kind === "album" ? "专辑" : item.kind === "show" ? "播客" : "歌单";
            const subText = isArtist ? "艺人" : `${typeLabel} · ${item.ownerName || item.subtitle || "Spotify"}`;

            row.innerHTML = `
                <img src="${escapeHtml(item.cover || FALLBACK_COVER)}" class="lib-cover-img ${isArtist ? "round" : ""}" alt="">
                <div class="lib-meta-col">
                    <span class="lib-row-title">${escapeHtml(item.name)}</span>
                    <span class="lib-row-sub">${escapeHtml(subText)}</span>
                </div>
            `;
            row.addEventListener("click", () => openEntity(item));
            container.appendChild(row);
        }
    }

    // =========================================================================
    // 13. 歌单 / 专辑 / 播客 / 我喜欢的音乐 详情页 (全量分页加载)
    // =========================================================================
    function openLikedSongsDetail() {
        showView("playlist", true);
        state.currentDetailUri = "spotify:collection:tracks";
        document.getElementById("playlistNavTitle").textContent = "我喜欢的音乐";
        document.getElementById("playlistHeroName").textContent = "我喜欢的音乐";
        document.getElementById("playlistHeroCover").src = FALLBACK_COVER;
        document.getElementById("btnPlaylistSave").style.display = "none";

        if (!state.isLoggedIn) {
            document.getElementById("playlistHeroMeta").textContent = "未登录";
            document.getElementById("playlistTracksList").innerHTML = `<div class="sp-loading-box">请先登录 Spotify 账号以查看我喜欢的音乐</div>`;
            return;
        }

        state.currentDetailTracks = state.likedTracks;
        document.getElementById("playlistHeroMeta").textContent = `我的收藏 · ${state.likedTracks.length} 首歌曲`;
        renderTracksToElement(document.getElementById("playlistTracksList"), state.likedTracks, "我喜欢的音乐");

        // 如果尚未同步完毕，触发后台补全
        if (state.likedTracks.length === 0) {
            syncAllLikedTracks().then(() => {
                if (state.activeView === "playlist" && state.currentDetailUri === "spotify:collection:tracks") {
                    state.currentDetailTracks = state.likedTracks;
                    document.getElementById("playlistHeroMeta").textContent = `我的收藏 · ${state.likedTracks.length} 首歌曲`;
                    renderTracksToElement(document.getElementById("playlistTracksList"), state.likedTracks, "我喜欢的音乐");
                }
            });
        }
    }

    async function openPlaylistDetail(uri, title, cover) {
        showView("playlist", true);
        state.currentDetailUri = uri;
        state.currentDetailTracks = [];

        document.getElementById("playlistNavTitle").textContent = title || "歌单";
        document.getElementById("playlistHeroName").textContent = title || "歌单";
        document.getElementById("playlistHeroCover").src = cover || FALLBACK_COVER;
        document.getElementById("playlistHeroMeta").textContent = "正在全量加载曲目...";
        document.getElementById("btnPlaylistSave").style.display = "none";
        const listEl = document.getElementById("playlistTracksList");
        listEl.innerHTML = `<div class="sp-loading-box">正在同步歌单全部歌曲...</div>`;

        try {
            const allTracks = [];
            let offset = 0;
            const limit = 100;
            let totalCount = 0;
            let plName = title || "歌单";
            let plOwner = "Spotify";

            while (offset < 2000) {
                const res = await gql("fetchPlaylist", {
                    uri: uri,
                    offset: offset,
                    limit: limit,
                    enableWatchFeedEntrypoint: false
                });
                const pl = res?.data?.playlistV2;
                if (!pl) break;

                if (offset === 0) {
                    plName = pl.name || plName;
                    plOwner = pl.ownerV2?.data?.name || plOwner;
                    const plCover = bestImage(pl.images) || cover || FALLBACK_COVER;
                    document.getElementById("playlistNavTitle").textContent = plName;
                    document.getElementById("playlistHeroName").textContent = plName;
                    document.getElementById("playlistHeroCover").src = plCover;
                }

                const content = pl.content || {};
                totalCount = content.totalCount || totalCount;
                const items = content.items || [];

                for (const it of items) {
                    const tr = parseTrack(it?.itemV2?.data);
                    if (tr) allTracks.push(tr);
                }

                // 边分页边渲染，避免长歌单白屏
                if (state.currentDetailUri !== uri) return;
                state.currentDetailTracks = allTracks;
                document.getElementById("playlistHeroMeta").textContent = `${plOwner} · ${allTracks.length} / ${Math.max(totalCount, allTracks.length)} 首歌曲`;
                renderTracksToElement(listEl, allTracks, plName);

                offset += items.length;
                if (items.length === 0 || offset >= totalCount) break;
            }

            if (state.currentDetailUri === uri) {
                document.getElementById("playlistHeroMeta").textContent = `${plOwner} · ${allTracks.length} 首歌曲`;
                if (allTracks.length === 0) {
                    listEl.innerHTML = `<div class="sp-loading-box">该歌单暂无可播放曲目</div>`;
                }
            }
        } catch (err) {
            listEl.innerHTML = `<div class="sp-loading-box">加载歌单失败：${escapeHtml(err.message)}</div>`;
        }
    }

    async function openAlbumDetail(uri, title, cover) {
        showView("playlist", true);
        state.currentDetailUri = uri;
        state.currentDetailTracks = [];

        document.getElementById("playlistNavTitle").textContent = title || "专辑";
        document.getElementById("playlistHeroName").textContent = title || "专辑";
        document.getElementById("playlistHeroCover").src = cover || FALLBACK_COVER;
        document.getElementById("playlistHeroMeta").textContent = "正在加载专辑...";
        document.getElementById("btnPlaylistSave").style.display = "none";
        const listEl = document.getElementById("playlistTracksList");
        listEl.innerHTML = `<div class="sp-loading-box">正在加载专辑曲目...</div>`;

        try {
            const allTracks = [];
            let offset = 0;
            const limit = 50;
            let totalCount = 0;
            let albName = title || "专辑";
            let albCover = cover || FALLBACK_COVER;
            let albArtist = "";

            while (offset < 500) {
                const res = await gql("getAlbum", { uri, locale: "", offset, limit });
                const alb = res?.data?.albumUnion;
                if (!alb) break;

                if (offset === 0) {
                    albName = alb.name || albName;
                    albCover = bestImage(alb.coverArt) || albCover;
                    albArtist = ((alb.artists && alb.artists.items) || []).map(a => a.profile?.name).filter(Boolean).join(", ");
                    document.getElementById("playlistNavTitle").textContent = albName;
                    document.getElementById("playlistHeroName").textContent = albName;
                    document.getElementById("playlistHeroCover").src = albCover;
                }

                const tv2 = alb.tracksV2 || {};
                totalCount = tv2.totalCount || totalCount;
                const items = tv2.items || [];
                const fallbackAlb = { uri, name: albName, cover: albCover, artist: albArtist };

                for (const it of items) {
                    const tr = parseTrack(it?.track, fallbackAlb);
                    if (tr) allTracks.push(tr);
                }

                offset += items.length;
                if (items.length === 0 || offset >= totalCount) break;
            }

            if (state.currentDetailUri !== uri) return;
            state.currentDetailTracks = allTracks;
            document.getElementById("playlistHeroMeta").textContent = `${albArtist || "专辑"} · ${allTracks.length} 首歌曲`;
            renderTracksToElement(listEl, allTracks, albName);
        } catch (err) {
            listEl.innerHTML = `<div class="sp-loading-box">加载专辑失败：${escapeHtml(err.message)}</div>`;
        }
    }

    async function openShowDetail(uri, title, cover) {
        showView("playlist", true);
        state.currentDetailUri = uri;
        state.currentDetailTracks = [];

        document.getElementById("playlistNavTitle").textContent = title || "播客";
        document.getElementById("playlistHeroName").textContent = title || "播客";
        document.getElementById("playlistHeroCover").src = cover || FALLBACK_COVER;
        document.getElementById("playlistHeroMeta").textContent = "正在加载播客剧集...";
        const listEl = document.getElementById("playlistTracksList");
        listEl.innerHTML = `<div class="sp-loading-box">正在加载播客剧集...</div>`;

        try {
            const metaRes = await gql("queryShowMetadataV2", {
                uri,
                includeContentCapabilityTrait: false,
                includeEpisodeContentRatingsV2: false
            });
            const m = metaRes?.data?.podcastUnionV2 || {};
            const showName = m.name || title || "播客";
            const pub = m.publisher?.name || "播客节目";
            const showCover = bestImage(m.coverArt) || cover || FALLBACK_COVER;
            document.getElementById("playlistNavTitle").textContent = showName;
            document.getElementById("playlistHeroName").textContent = showName;
            document.getElementById("playlistHeroCover").src = showCover;

            const epRes = await gql("queryPodcastEpisodes", {
                uri,
                offset: 0,
                limit: 50,
                includeEpisodeContentRatingsV2: false
            });
            const eps = epRes?.data?.podcastUnionV2?.episodesV2?.items || [];
            const tracks = eps.map(it => {
                const e = it?.entity;
                const d = e?.data;
                if (!d || !d.name) return null;
                return {
                    id: idFromUri(e._uri || ""),
                    uri: e._uri || "",
                    title: d.name,
                    artist: pub,
                    album: showName,
                    cover: bestImage(d.coverArt) || showCover,
                    durationMs: d.duration?.totalMilliseconds || 0
                };
            }).filter(Boolean);

            state.currentDetailTracks = tracks;
            document.getElementById("playlistHeroMeta").textContent = `${pub} · ${tracks.length} 集`;
            renderTracksToElement(listEl, tracks, showName);
        } catch (err) {
            listEl.innerHTML = `<div class="sp-loading-box">加载播客失败：${escapeHtml(err.message)}</div>`;
        }
    }

    function renderTracksToElement(container, tracks, sourceName) {
        container.innerHTML = "";
        if (!tracks || tracks.length === 0) {
            container.innerHTML = `<div class="sp-loading-box">暂无歌曲</div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        tracks.forEach((tr, idx) => {
            const row = document.createElement("div");
            row.className = "sp-track-row";
            if (state.currentTrack && state.currentTrack.id === tr.id) row.classList.add("playing");
            const isLiked = tr.id && state.likedTrackIds.has(tr.id);
            row.innerHTML = `
                <img src="${escapeHtml(tr.cover || FALLBACK_COVER)}" class="track-row-cover" alt="">
                <div class="track-row-info">
                    <span class="track-row-title">${escapeHtml(tr.title)}</span>
                    <span class="track-row-artist">${escapeHtml(tr.artist)}</span>
                </div>
                <button class="track-row-more ${isLiked ? "liked" : ""}" title="收藏">
                    <svg viewBox="0 0 24 24" fill="${isLiked ? "#1ed760" : "none"}" stroke="${isLiked ? "#1ed760" : "currentColor"}" stroke-width="2" width="18" height="18">
                        <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>
                    </svg>
                </button>
            `;
            row.addEventListener("click", () => {
                playTrack(tr, tracks, idx, sourceName || "歌单");
            });
            row.querySelector(".track-row-more").addEventListener("click", (e) => {
                e.stopPropagation();
                toggleTrackLike(tr, row.querySelector(".track-row-more"));
            });
            frag.appendChild(row);
        });
        container.appendChild(frag);
    }

    async function toggleTrackLike(track, btnEl) {
        if (!track || !track.id) return;
        if (!state.isLoggedIn) {
            Native.toast("请先登录 Spotify 账号后再点赞收藏");
            return;
        }
        const currentlyLiked = state.likedTrackIds.has(track.id);
        const nextLiked = !currentlyLiked;
        const op = nextLiked ? "addToLibrary" : "removeFromLibrary";
        try {
            await gql(op, { libraryItemUris: ["spotify:track:" + track.id] });
            if (nextLiked) {
                state.likedTrackIds.add(track.id);
                if (!state.likedTracks.some(x => x.id === track.id)) state.likedTracks.unshift(track);
            } else {
                state.likedTrackIds.delete(track.id);
                state.likedTracks = state.likedTracks.filter(x => x.id !== track.id);
            }
            if (btnEl) {
                btnEl.classList.toggle("liked", nextLiked);
                const svg = btnEl.querySelector("svg");
                if (svg) {
                    svg.setAttribute("fill", nextLiked ? "#1ed760" : "none");
                    svg.setAttribute("stroke", nextLiked ? "#1ed760" : "currentColor");
                }
            }
            syncCurrentTrackLikeIcons();
            const countEl = document.getElementById("libLikedCountText");
            if (countEl) countEl.textContent = `📌 歌单 · ${state.likedTracks.length} 首歌曲`;
            Native.toast(nextLiked ? "已添加到我喜欢的音乐" : "已从我喜欢的音乐移除");
        } catch (err) {
            Native.toast("操作失败：" + (err.message || ""));
        }
    }

    function syncCurrentTrackLikeIcons() {
        const liked = Boolean(state.currentTrack && state.currentTrack.id && state.likedTrackIds.has(state.currentTrack.id));
        ["miniBtnLike", "npBtnLike"].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle("liked", liked);
            const svg = btn.querySelector("svg");
            if (svg) {
                svg.setAttribute("fill", liked ? "#1ed760" : "none");
                svg.setAttribute("stroke", liked ? "#1ed760" : "currentColor");
            }
        });
    }

    // =========================================================================
    // 14. 播放引擎、队列管理与拖拽进度条 (修复问题2)
    // =========================================================================
    async function playTrack(track, queueList, queueIndex, sourceName) {
        if (!track) return;
        Native.vibrate(12);

        if (Array.isArray(queueList) && queueList.length > 0) {
            state.queue = queueList;
            state.queueIndex = typeof queueIndex === "number" ? queueIndex : queueList.findIndex(x => x.id === track.id);
        }
        if (sourceName) state.playingFromName = sourceName;

        state.currentTrack = track;
        state.isPlaying = true;
        state.currentTime = 0;
        state.duration = track.durationMs ? track.durationMs / 1000 : 0;

        // 立即更新 UI
        document.getElementById("miniCoverImg").src = track.cover || FALLBACK_COVER;
        document.getElementById("miniTitle").textContent = track.title;
        document.getElementById("miniArtist").textContent = track.artist;

        document.getElementById("npLargeCoverImg").src = track.cover || FALLBACK_COVER;
        document.getElementById("npTrackTitle").textContent = track.title;
        document.getElementById("npTrackArtist").textContent = track.artist;
        document.getElementById("npPlayingFrom").textContent = state.playingFromName || "为你推荐";
        document.getElementById("npTimeCurrent").textContent = "0:00";
        document.getElementById("npTimeDuration").textContent = formatTime(state.duration);
        updateScrubberVisual(0);
        syncCurrentTrackLikeIcons();
        updatePlayPauseIcons(true);

        // 异步加载高精歌词
        loadTrackLyrics(track);

        // 解析可播放音频流
        try {
            const audioRes = await Native.resolveAudioUrl(track.title, track.artist);
            if (audioRes && audioRes.audioUrl) {
                Native.playAudio(audioRes.audioUrl, track.title, track.artist, track.cover || "");
            } else {
                Native.toast("暂未匹配到可播放音源");
            }
        } catch (err) {
            Native.toast("音源解析失败：" + (err.message || ""));
        }
    }

    function playNextTrack() {
        if (!state.queue || state.queue.length === 0) return;
        let nextIdx;
        if (state.shuffle) {
            nextIdx = Math.floor(Math.random() * state.queue.length);
        } else {
            nextIdx = (state.queueIndex + 1) % state.queue.length;
        }
        state.queueIndex = nextIdx;
        playTrack(state.queue[nextIdx], state.queue, nextIdx, state.playingFromName);
    }

    function playPrevTrack() {
        if (!state.queue || state.queue.length === 0) return;
        if (state.currentTime > 4) {
            Native.seekAudio(0);
            return;
        }
        const prevIdx = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
        state.queueIndex = prevIdx;
        playTrack(state.queue[prevIdx], state.queue, prevIdx, state.playingFromName);
    }

    function updatePlayPauseIcons(playing) {
        state.isPlaying = playing;
        document.getElementById("miniIconPlay").style.display = playing ? "none" : "block";
        document.getElementById("miniIconPause").style.display = playing ? "block" : "none";
        document.getElementById("npIconPlay").style.display = playing ? "none" : "block";
        document.getElementById("npIconPause").style.display = playing ? "block" : "none";
    }

    function updateScrubberVisual(pct) {
        const clamped = Math.max(0, Math.min(100, pct));
        const fill = document.getElementById("npScrubFill");
        const thumb = document.getElementById("npScrubThumb");
        const miniFill = document.getElementById("miniProgressFill");
        if (fill) fill.style.width = clamped + "%";
        if (thumb) thumb.style.left = clamped + "%";
        if (miniFill) miniFill.style.width = clamped + "%";
    }

    // 触控与鼠标平滑拖拽进度条绑定
    function setupDraggableScrubber() {
        const wrap = document.getElementById("npScrubWrap");
        const rail = document.getElementById("npScrubRail");
        if (!wrap || !rail) return;

        let dragFrac = 0;

        const calcFrac = (clientX) => {
            const rect = rail.getBoundingClientRect();
            if (!rect.width) return 0;
            return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        };

        const getEffectiveDuration = () => {
            if (state.duration > 0) return state.duration;
            if (state.currentTrack && state.currentTrack.durationMs > 0) {
                return state.currentTrack.durationMs / 1000;
            }
            return 0;
        };

        const onStart = (clientX) => {
            const dur = getEffectiveDuration();
            if (dur <= 0) return;
            state.isDraggingScrub = true;
            wrap.classList.add("dragging");
            dragFrac = calcFrac(clientX);
            updateScrubberVisual(dragFrac * 100);
            document.getElementById("npTimeCurrent").textContent = formatTime(dragFrac * dur);
        };

        const onMove = (clientX) => {
            if (!state.isDraggingScrub) return;
            const dur = getEffectiveDuration();
            dragFrac = calcFrac(clientX);
            updateScrubberVisual(dragFrac * 100);
            document.getElementById("npTimeCurrent").textContent = formatTime(dragFrac * dur);
        };

        const onEnd = () => {
            if (!state.isDraggingScrub) return;
            state.isDraggingScrub = false;
            wrap.classList.remove("dragging");
            const dur = getEffectiveDuration();
            if (dur > 0) {
                const targetSec = dragFrac * dur;
                state.currentTime = targetSec;
                Native.seekAudio(Math.floor(targetSec * 1000));
            }
        };

        // 移动端 Touch 事件
        wrap.addEventListener("touchstart", (e) => {
            if (e.touches && e.touches.length > 0) {
                e.preventDefault();
                onStart(e.touches[0].clientX);
            }
        }, { passive: false });

        wrap.addEventListener("touchmove", (e) => {
            if (state.isDraggingScrub && e.touches && e.touches.length > 0) {
                e.preventDefault();
                onMove(e.touches[0].clientX);
            }
        }, { passive: false });

        wrap.addEventListener("touchend", () => onEnd());
        wrap.addEventListener("touchcancel", () => onEnd());

        // 桌面调试 Mouse 事件
        wrap.addEventListener("mousedown", (e) => {
            e.preventDefault();
            onStart(e.clientX);
        });
        window.addEventListener("mousemove", (e) => {
            if (state.isDraggingScrub) onMove(e.clientX);
        });
        window.addEventListener("mouseup", () => {
            if (state.isDraggingScrub) onEnd();
        });
    }

    // =========================================================================
    // 15. 歌词加载与高亮滚动
    // =========================================================================
    async function loadTrackLyrics(track) {
        const streamEl = document.getElementById("lyricsStream");
        state.lyrics = [];
        state.activeLyricIdx = -1;
        streamEl.innerHTML = `<div class="lyrics-loading-text">正在获取高精双语歌词...</div>`;

        try {
            const res = await Native.fetchLyrics(track.id, track.title, track.artist, (track.durationMs || 0) / 1000);
            const lines = parseLrcLines(res?.lrc || "", res?.tlyric || "");
            if (lines.length === 0) {
                streamEl.innerHTML = `<div class="lyrics-loading-text">暂未找到同步歌词</div>`;
                return;
            }
            state.lyrics = lines;
            streamEl.innerHTML = "";
            lines.forEach((l, i) => {
                const div = document.createElement("div");
                div.className = "lyric-line-box";
                div.dataset.idx = i;
                div.innerHTML = `<div>${escapeHtml(l.text)}</div>${l.trans ? `<div class="lyric-trans-line">${escapeHtml(l.trans)}</div>` : ""}`;
                div.addEventListener("click", (e) => {
                    e.stopPropagation();
                    Native.seekAudio(Math.floor(l.time * 1000));
                });
                streamEl.appendChild(div);
            });
        } catch (err) {
            streamEl.innerHTML = `<div class="lyrics-loading-text">暂无歌词</div>`;
        }
    }

    function parseLrcLines(lrc, tlyric) {
        const parseMap = (raw) => {
            const out = [];
            const re = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;
            for (const line of (raw || "").split(/\r?\n/)) {
                const m = line.match(re);
                if (!m) continue;
                const min = parseInt(m[1], 10);
                const sec = parseInt(m[2], 10);
                const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
                const txt = m[4].trim();
                if (txt) out.push({ time: min * 60 + sec + ms / 1000, text: txt });
            }
            return out.sort((a, b) => a.time - b.time);
        };
        const main = parseMap(lrc);
        const trans = parseMap(tlyric);
        for (const m of main) {
            const match = trans.find(t => Math.abs(t.time - m.time) < 0.8);
            if (match) m.trans = match.text;
        }
        return main;
    }

    function syncLyricsHighlight(currentSec) {
        if (!state.lyrics.length) return;
        let idx = -1;
        for (let i = 0; i < state.lyrics.length; i++) {
            if (currentSec >= state.lyrics[i].time) idx = i;
            else break;
        }
        if (idx === state.activeLyricIdx) return;
        state.activeLyricIdx = idx;

        const streamEl = document.getElementById("lyricsStream");
        const nodes = streamEl.querySelectorAll(".lyric-line-box");
        nodes.forEach((n, i) => {
            n.classList.toggle("active", i === idx);
        });
        if (idx >= 0 && nodes[idx]) {
            nodes[idx].scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    // =========================================================================
    // 16. 原生回调钩子
    // =========================================================================
    window.onNativePlaybackStateChanged = function (isPlaying, posMs, durMs) {
        updatePlayPauseIcons(isPlaying);
        if (durMs > 0) {
            state.duration = durMs / 1000;
            document.getElementById("npTimeDuration").textContent = formatTime(state.duration);
        }
        // 拖拽过程中禁止原生 tick 覆盖用户手指位置
        if (!state.isDraggingScrub) {
            state.currentTime = posMs / 1000;
            document.getElementById("npTimeCurrent").textContent = formatTime(state.currentTime);
            const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
            updateScrubberVisual(pct);
            syncLyricsHighlight(state.currentTime);
        }
    };

    window.onNativeTrackEnded = function () {
        if (state.repeat && state.currentTrack) {
            Native.seekAudio(0);
            Native.resumeAudio();
        } else {
            playNextTrack();
        }
    };
    window.onNativeNextRequested = () => playNextTrack();
    window.onNativePrevRequested = () => playPrevTrack();

    window.onNativeLoginSuccess = function (loggedIn) {
        if (loggedIn) {
            state.accessToken = "";
            syncSpotifyData(true);
        } else {
            renderLoggedOutUI();
        }
    };

    // =========================================================================
    // 17. 全局事件绑定与初始化
    // =========================================================================
    function bindEvents() {
        // 底部 3-Tab
        document.querySelectorAll(".nav-tab").forEach(btn => {
            btn.addEventListener("click", () => switchTab(btn.dataset.tab));
        });

        // 首页过滤 Chips（全部 / 音乐 / 播客）
        document.querySelectorAll("#homeFilterChips .sp-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                document.querySelectorAll("#homeFilterChips .sp-chip").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                loadHomeFeed(chip.dataset.facet || "");
            });
        });

        // 首页桌面端核心频道直达按钮
        document.getElementById("btnNavDaily").addEventListener("click", () => {
            if (state.dailyMixUri) {
                openPlaylistDetail(state.dailyMixUri, "每日推荐", "");
            } else if (state.likedTracks.length > 0) {
                openLikedSongsDetail();
            } else {
                Native.toast("请先登录账号获取专属每日推荐");
            }
        });
        document.getElementById("btnNavCharts").addEventListener("click", () => openChartsPage());
        document.getElementById("btnNavRecent").addEventListener("click", () => openRecentPage());
        document.getElementById("btnNavBrowse").addEventListener("click", () => {
            switchTab("search");
            const searchIn = document.getElementById("searchInput");
            if (searchIn) {
                searchIn.value = "";
                onSearchChange("");
            }
        });

        // 音乐库过滤 Chips（全部 / 播放列表 / 专辑 / 艺人）
        document.querySelectorAll("#libFilterChips .sp-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                document.querySelectorAll("#libFilterChips .sp-chip").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                state.libFilter = chip.dataset.libFilter || "all";
                renderLibraryView();
            });
        });

        // 头像与设置入口
        ["btnOpenSettings", "homeAvatarBtn", "searchAvatarBtn", "libAvatarBtn"].forEach(id => {
            document.getElementById(id)?.addEventListener("click", () => showView("settings", true));
        });

        // 全部二级页面返回按钮 -> 统一走返回栈
        ["btnPlaylistBack", "btnArtistBack", "btnCategoryBack", "btnChartsBack", "btnRecentBack", "btnSettingsBack"].forEach(id => {
            document.getElementById(id)?.addEventListener("click", () => goBack());
        });

        // 音乐库固定入口与刷新
        document.getElementById("libRowLiked").addEventListener("click", () => openLikedSongsDetail());
        document.getElementById("btnSyncLibrary").addEventListener("click", () => syncSpotifyData(true));

        // 歌单详情页全部播放
        document.getElementById("btnPlayAllInHero").addEventListener("click", () => {
            if (state.currentDetailTracks.length > 0) {
                const name = document.getElementById("playlistHeroName").textContent;
                playTrack(state.currentDetailTracks[0], state.currentDetailTracks, 0, name);
            }
        });

        // 艺人主页按钮
        document.getElementById("btnArtistFollow").addEventListener("click", () => toggleArtistFollow());
        document.getElementById("btnArtistPlayTop").addEventListener("click", () => {
            if (state.currentArtist && state.currentArtist.topTracks && state.currentArtist.topTracks.length > 0) {
                playTrack(state.currentArtist.topTracks[0], state.currentArtist.topTracks, 0, state.currentArtist.name);
            }
        });

        // 搜索栏输入与清空
        const searchIn = document.getElementById("searchInput");
        searchIn.addEventListener("input", (e) => onSearchChange(e.target.value));
        document.getElementById("btnClearSearch").addEventListener("click", () => {
            searchIn.value = "";
            onSearchChange("");
        });

        // 迷你播放条与全屏播放器
        document.getElementById("miniMetaClickArea").addEventListener("click", () => npFullscreen.classList.add("open"));
        document.getElementById("miniCoverImg").addEventListener("click", () => npFullscreen.classList.add("open"));
        document.getElementById("btnDismissNp").addEventListener("click", () => npFullscreen.classList.remove("open"));

        // 在全屏播放器点击艺人名直接跳转艺人主页
        document.getElementById("npTrackArtist").addEventListener("click", () => {
            if (state.currentTrack && state.currentTrack.artistUri) {
                npFullscreen.classList.remove("open");
                openArtistPage(state.currentTrack.artistUri, state.currentTrack.artist.split(",")[0].trim(), "");
            }
        });

        const togglePlay = () => {
            if (!state.currentTrack) return;
            if (state.isPlaying) {
                Native.pauseAudio();
                updatePlayPauseIcons(false);
            } else {
                Native.resumeAudio();
                updatePlayPauseIcons(true);
            }
        };
        document.getElementById("miniBtnPlayPause").addEventListener("click", (e) => { e.stopPropagation(); togglePlay(); });
        document.getElementById("npBtnPlayPause").addEventListener("click", togglePlay);

        document.getElementById("miniBtnLike").addEventListener("click", (e) => {
            e.stopPropagation();
            if (state.currentTrack) toggleTrackLike(state.currentTrack);
        });
        document.getElementById("npBtnLike").addEventListener("click", () => {
            if (state.currentTrack) toggleTrackLike(state.currentTrack);
        });

        document.getElementById("npBtnPrev").addEventListener("click", () => playPrevTrack());
        document.getElementById("npBtnNext").addEventListener("click", () => playNextTrack());
        document.getElementById("npBtnShuffle").addEventListener("click", () => {
            state.shuffle = !state.shuffle;
            document.getElementById("npBtnShuffle").classList.toggle("active", state.shuffle);
            Native.toast(state.shuffle ? "已开启随机播放" : "已关闭随机播放");
        });
        document.getElementById("npBtnRepeat").addEventListener("click", () => {
            state.repeat = !state.repeat;
            document.getElementById("npBtnRepeat").classList.toggle("active", state.repeat);
            Native.toast(state.repeat ? "单曲循环" : "列表循环");
        });

        // 触控拖拽进度条
        setupDraggableScrubber();

        // 歌词展开/收起
        btnExpandLyrics.addEventListener("click", (e) => {
            e.stopPropagation();
            const isExp = npLyricsCard.classList.toggle("expanded");
            btnExpandLyrics.textContent = isExp ? "收起" : "全屏查看";
        });
        npLyricsCard.addEventListener("click", () => {
            if (!npLyricsCard.classList.contains("expanded")) {
                npLyricsCard.classList.add("expanded");
                btnExpandLyrics.textContent = "收起";
            }
        });

        // 设置页动作
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
            Native.toast("已退出登录");
        });

        // 代理配置
        const savedProxy = Native.getProxy();
        if (savedProxy) document.getElementById("inputProxy").value = savedProxy;
        document.getElementById("btnSaveProxy").addEventListener("click", () => {
            const p = document.getElementById("inputProxy").value.trim();
            Native.setProxy(p);
            Native.toast(p ? "已保存代理：" + p : "已恢复系统默认代理");
        });

        // 缓存清理
        Native.getCacheSize((err, res) => {
            if (!err && res && res.formatted) {
                document.getElementById("settingsCacheDesc").textContent = "已用缓存: " + res.formatted;
            }
        });
        document.getElementById("btnClearCache").addEventListener("click", () => {
            Native.clearCache(() => {
                document.getElementById("settingsCacheDesc").textContent = "已用缓存: 0 B";
                Native.toast("缓存已清除");
            });
        });
    }

    function init() {
        bindEvents();
        syncSpotifyData(false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
