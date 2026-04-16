(function () {
  const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='31' fill='%231b263b'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23ebebea'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23ebebea'/%3E%3C/svg%3E";
  const FALLBACK_POSTER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'%3E%3Crect width='500' height='750' fill='%230d1b2a'/%3E%3Crect x='18' y='18' width='464' height='714' rx='18' ry='18' fill='%231b263b' stroke='%23778da9' stroke-width='4'/%3E%3Ctext x='250' y='360' text-anchor='middle' fill='%23ebebea' font-size='38' font-family='Arial, sans-serif'%3ENo%3C/text%3E%3Ctext x='250' y='410' text-anchor='middle' fill='%23ebebea' font-size='38' font-family='Arial, sans-serif'%3EPoster%3C/text%3E%3C/svg%3E";

  const formEl = document.getElementById("profile-form");
  const nameHeading = document.getElementById("profile-name-heading");
  const memberSinceEl = document.getElementById("profile-member-since");
  const authStatusEl = document.getElementById("profile-auth-status");
  const navStatusEl = document.getElementById("auth-status");
  const overviewFavoritesCountEl = document.getElementById("overview-favorites-count");
  const overviewWatchlistCountEl = document.getElementById("overview-watchlist-count");
  const overviewHistoryCountEl = document.getElementById("overview-history-count");
  const favoritesListEl = document.getElementById("profile-favorites-list");
  const watchlistListEl = document.getElementById("profile-watchlist-list");
  const historyListEl = document.getElementById("profile-history-list");
  const favoritesEmptyEl = document.getElementById("profile-favorites-empty");
  const watchlistEmptyEl = document.getElementById("profile-watchlist-empty");
  const historyEmptyEl = document.getElementById("profile-history-empty");
  const displayNameInput = document.getElementById("profile-display-name");
  const emailInput = document.getElementById("profile-email");
  const avatarPreview = document.getElementById("profile-avatar-preview");
  const saveMessage = document.getElementById("profile-save-message");
  const saveBtn = document.getElementById("profile-save-btn");
  const changeBackdropBtn = document.getElementById("profile-change-backdrop-btn");
  const pickRandomBtn = document.getElementById("profile-pick-random-btn");
  const uploadBackdropBtn = document.getElementById("profile-upload-backdrop-btn");
  const backdropFileInput = document.getElementById("profile-backdrop-file-input");
  const backdropSearchInput = document.getElementById("profile-backdrop-search");
  const changeIconBtn = document.getElementById("profile-change-icon-btn");
  const iconFileInput = document.getElementById("profile-icon-file-input");
  const navProfileAvatar = document.querySelector("#profile-link .profile-avatar");
  const profileImageSurface = document.querySelector(".profile-image-surface");
  const ACTION_ICONS = {
    watch: "/assets/play-512.png",
    watchlist: "/assets/plus-2-512.png",
    favorite: "/assets/favorite-2-512.png",
    remove: "/assets/trash-2-512.png"
  };

  let supabaseClient = null;
  let currentUser = null;
  let slidersInitialized = false;
  let profileBackdropCandidates = [];
  let lastBackdropPath = "";
  let pendingBackdropSource = "";
  let pendingAvatarSource = "";
  let profileBackdropTimer = null;

  function setStatus(message) {
    if (authStatusEl) {
      authStatusEl.textContent = message;
    }
    if (navStatusEl) {
      navStatusEl.textContent = message;
    }
  }

  function setSaveMessage(message, isError) {
    if (!saveMessage) {
      return;
    }

    saveMessage.textContent = message;
    saveMessage.style.color = isError ? "#ffb4b4" : "#cfd6de";
  }

  function emitRealtimeAppEvent(type, details) {
    if (!window.FiscusRealtime || typeof window.FiscusRealtime.emitAppEvent !== "function") {
      return;
    }

    window.FiscusRealtime.emitAppEvent(type, details || {});
  }

  function isConfigured() {
    if (!window.SUPABASE_CONFIG || !window.supabase) {
      return false;
    }

    const { url, anonKey } = window.SUPABASE_CONFIG;
    if (!url || !anonKey || url.includes("YOUR_PROJECT_ID") || anonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
      return false;
    }

    return true;
  }

  function getUserMetadata(user) {
    return (user && user.user_metadata) || {};
  }

  function resolveUserAvatar(user) {
    const metadata = getUserMetadata(user);
    return metadata.avatar_url || metadata.picture || FALLBACK_AVATAR;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function extractYear(item) {
    if (item.year) {
      return String(item.year);
    }

    const source = item.release_date || item.first_air_date || item.date;
    if (source && String(source).length >= 4) {
      return String(source).slice(0, 4);
    }

    return "";
  }

  function normalizePoster(posterValue) {
    if (!posterValue || posterValue === "N/A") {
      return FALLBACK_POSTER;
    }

    if (String(posterValue).startsWith("/")) {
      return `https://image.tmdb.org/t/p/w500${posterValue}`;
    }

    return posterValue;
  }

  function normalizeLocalItems(items) {
    return (items || []).map((item) => ({
      title: item.title || item.name || "Untitled",
      year: extractYear(item),
      poster: normalizePoster(item.poster || item.poster_path),
      tmdb_id: item.tmdb_id || item.id || "",
      imdb_id: item.imdbID || item.imdb_id || "",
      media_type: item.media_type || "movie"
    }));
  }

  function normalizeWatchlistItems(items) {
    return (items || []).map((item) => {
      const movieId = item.movie_id || "";
      const tmdbId = typeof movieId === "string" && movieId.startsWith("tmdb:")
        ? movieId.replace("tmdb:", "")
        : "";

      return {
        title: item.title || "Untitled",
        year: extractYear(item),
        poster: normalizePoster(item.poster_url || item.poster),
        tmdb_id: tmdbId,
        imdb_id: item.imdb_id || "",
        media_type: "movie"
      };
    });
  }

  function getStorageScopeKey() {
    return currentUser && currentUser.id ? currentUser.id : "guest";
  }

  function getCollectionStorageKey(collectionName) {
    return `fiscus:${collectionName}:${getStorageScopeKey()}`;
  }

  function readCollection(collectionName) {
    const raw = localStorage.getItem(getCollectionStorageKey(collectionName));
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeCollection(collectionName, items) {
    localStorage.setItem(getCollectionStorageKey(collectionName), JSON.stringify(items));
  }

  function buildTmdbBackdropUrl(backdropPath, size) {
    if (!backdropPath) {
      return "";
    }

    return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
  }

  async function fetchDiscoverBackdropCandidates() {
    const randomPage = Math.floor(Math.random() * 20) + 1;
    const discoverUrl = `/api/tmdb/discover/movie?include_adult=false&include_video=false&language=en-US&page=${randomPage}&sort_by=popularity.desc&vote_count.gte=100`;

    try {
      const response = await fetch(discoverUrl);
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const withBackdrop = (data.results || []).filter((item) => item && item.backdrop_path);
      const uniquePaths = [...new Set(withBackdrop.map((item) => String(item.backdrop_path)))];
      return uniquePaths;
    } catch (error) {
      return [];
    }
  }

  function pickRandomBackdropPath(paths) {
    if (!Array.isArray(paths) || !paths.length) {
      return "";
    }

    if (paths.length === 1) {
      return paths[0];
    }

    const pool = paths.filter((path) => path !== lastBackdropPath);
    if (!pool.length) {
      return paths[0];
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
  }

  async function applyRandomProfileBackdrop() {
    if (!profileImageSurface) {
      return;
    }

    if (!profileBackdropCandidates.length) {
      profileBackdropCandidates = await fetchDiscoverBackdropCandidates();
    }

    const backdropPath = pickRandomBackdropPath(profileBackdropCandidates);
    if (!backdropPath) {
      return;
    }

    const backdropUrl = buildTmdbBackdropUrl(backdropPath, "w1280");
    if (!backdropUrl) {
      return;
    }

    profileImageSurface.style.backgroundImage = `url("${backdropUrl}")`;
    lastBackdropPath = backdropPath;
    pendingBackdropSource = backdropUrl;
  }

  async function saveBackdropToUserProfile(backdropSource) {
    if (!supabaseClient || !currentUser) {
      return;
    }

    const updates = {
      data: {
        backdrop: backdropSource
      }
    };

    const { error } = await supabaseClient.auth.updateUser(updates);
    if (error) {
      console.error("Failed to save backdrop:", error);
    } else if (currentUser.user_metadata) {
      currentUser.user_metadata.backdrop = backdropSource;
      emitRealtimeAppEvent("backdrop:update", {
        userId: currentUser.id,
        backdrop: backdropSource
      });
    }
  }

  async function loadSavedBackdrop() {
    if (!currentUser || !currentUser.user_metadata || !currentUser.user_metadata.backdrop) {
      return false;
    }

    const backdrop = currentUser.user_metadata.backdrop;
    
    if (backdrop.startsWith("data:image")) {
      // It's a data URL from custom upload
      if (profileImageSurface) {
        profileImageSurface.style.backgroundImage = `url("${backdrop}")`;
        lastBackdropPath = backdrop;
      }
      pendingBackdropSource = "";
      return true;
    } else if (backdrop.startsWith("http")) {
      // It's a TMDB URL
      if (profileImageSurface) {
        profileImageSurface.style.backgroundImage = `url("${backdrop}")`;
        lastBackdropPath = backdrop;
      }
      pendingBackdropSource = "";
      return true;
    }

    return false;
  }

  async function applyBackdropFromMovieSearch(movieQuery) {
    if (!profileImageSurface || !movieQuery || movieQuery.trim().length === 0) {
      return false;
    }

    try {
      // Search for the movie
      const searchResponse = await fetch(`/api/tmdb/search/movie?query=${encodeURIComponent(movieQuery)}&include_adult=false&page=1`);
      if (!searchResponse.ok) {
        return false;
      }

      const searchData = await searchResponse.json();
      const movies = searchData.results || [];
      
      if (movies.length === 0) {
        return false;
      }

      // Use the first result
      const movie = movies[0];
      if (!movie.backdrop_path) {
        return false;
      }

      // Apply the backdrop
      const backdropUrl = buildTmdbBackdropUrl(movie.backdrop_path, "w1280");
      if (!backdropUrl) {
        return false;
      }

      profileImageSurface.style.backgroundImage = `url("${backdropUrl}")`;
      lastBackdropPath = movie.backdrop_path;
      await saveBackdropToUserProfile(backdropUrl);
      return true;
    } catch (error) {
      console.error("Error searching for movie backdrop:", error);
      return false;
    }
  }

  async function handleBackdropFileUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
      setSaveMessage("Please select a valid image file.", true);
      return false;
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage("Image must be smaller than 5MB.", true);
      return false;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;
        if (profileImageSurface) {
          profileImageSurface.style.backgroundImage = `url("${dataUrl}")`;
          lastBackdropPath = dataUrl;
          await saveBackdropToUserProfile(dataUrl);
          setSaveMessage("Custom background uploaded successfully!", false);
          resolve(true);
        } else {
          setSaveMessage("Could not apply background image.", true);
          resolve(false);
        }
      };
      reader.onerror = () => {
        setSaveMessage("Failed to read image file.", true);
        resolve(false);
      };
      reader.readAsDataURL(file);
    });
  }

  async function startProfileBackdropRotation() {
    await applyRandomProfileBackdrop();

    if (profileBackdropTimer) {
      window.clearInterval(profileBackdropTimer);
    }

    profileBackdropTimer = window.setInterval(() => {
      applyRandomProfileBackdrop();
    }, 90000);
  }

  async function fetchTmdbPosterPath(tmdbId, mediaType) {
    if (!tmdbId) {
      return "";
    }

    const type = mediaType === "tv" ? "tv" : "movie";

    try {
      const response = await fetch(`/api/tmdb/${type}/${tmdbId}`);
      if (!response.ok) {
        return "";
      }

      const data = await response.json();
      return data && data.poster_path ? String(data.poster_path) : "";
    } catch (error) {
      return "";
    }
  }

  async function hydrateMissingPosters(items) {
    if (!Array.isArray(items) || !items.length) {
      return items || [];
    }

    const updated = await Promise.all(items.map(async (item) => {
      if (item.poster && item.poster !== FALLBACK_POSTER) {
        return item;
      }

      if (!item.tmdb_id) {
        return item;
      }

      let posterPath = await fetchTmdbPosterPath(item.tmdb_id, item.media_type || "movie");
      if (!posterPath && item.media_type !== "tv") {
        // Some stored history rows may not have media_type; try TV fallback.
        posterPath = await fetchTmdbPosterPath(item.tmdb_id, "tv");
      }

      if (!posterPath) {
        return item;
      }

      return {
        ...item,
        poster: normalizePoster(posterPath)
      };
    }));

    return updated;
  }

  function updateCountSummary(watchlistItems, favoriteItems, historyItems) {
    if (overviewFavoritesCountEl) {
      overviewFavoritesCountEl.textContent = String(favoriteItems.length);
    }
    if (overviewHistoryCountEl) {
      overviewHistoryCountEl.textContent = String(historyItems.length);
    }
    if (overviewWatchlistCountEl) {
      overviewWatchlistCountEl.textContent = String(watchlistItems.length);
    }
  }

  function buildRailMarkup(items, listType) {
    return items.map((item) => {
      const safeTitle = escapeHtml(item.title || "Untitled");
      const safePoster = escapeHtml(item.poster || FALLBACK_POSTER);
      const safeYear = escapeHtml(item.year || "");
      const safeTmdb = escapeHtml(item.tmdb_id || "");
      const safeImdb = escapeHtml(item.imdb_id || "");
      const safeMedia = escapeHtml(item.media_type || "movie");
      const safeListType = escapeHtml(listType || "history");
      const titleLine = `${safeTitle}${safeYear ? ` (${safeYear})` : ""}`;
      const watchIcon = escapeHtml(ACTION_ICONS.watch);
      const watchlistIcon = escapeHtml(ACTION_ICONS.watchlist);
      const favoriteIcon = escapeHtml(ACTION_ICONS.favorite);
      const removeIcon = escapeHtml(ACTION_ICONS.remove);

      return `
        <li class="movie-poster-box profile-rail-card" data-list-type="${safeListType}" data-title="${safeTitle}" data-year="${safeYear}" data-tmdb-id="${safeTmdb}" data-imdb-id="${safeImdb}" data-media-type="${safeMedia}">
          <img class="recon-poster" src="${safePoster}" alt="${safeTitle} poster" loading="lazy">
          <div class="profile-rail-overlay">
            <h3>${titleLine}</h3>
            <div class="profile-rail-actions">
              <button class="profile-rail-icon-btn" type="button" data-action="watch" aria-label="Play now" title="Play now">
                <img src="${watchIcon}" alt="" loading="lazy">
              </button>
              <button class="profile-rail-icon-btn" type="button" data-action="watchlist" aria-label="Add to watchlist" title="Add to watchlist">
                <img src="${watchlistIcon}" alt="" loading="lazy">
              </button>
              <button class="profile-rail-icon-btn" type="button" data-action="favorite" aria-label="Add to favorite" title="Add to favorite">
                <img src="${favoriteIcon}" alt="" loading="lazy">
              </button>
              <button class="profile-rail-icon-btn profile-rail-icon-btn-remove" type="button" data-action="remove" aria-label="Delete from list" title="Delete from list">
                <img src="${removeIcon}" alt="" loading="lazy">
              </button>
            </div>
          </div>
        </li>
      `;
    }).join("");
  }

  function renderRail(listEl, emptyEl, items) {
    if (!listEl || !emptyEl) {
      return;
    }

    const sliderEl = listEl.closest(".profile-rail-slider");

    if (!items.length) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      if (sliderEl) {
        sliderEl.classList.add("hidden");
      }
      return;
    }

    const listType = listEl.id === "profile-favorites-list"
      ? "favorites"
      : listEl.id === "profile-watchlist-list"
        ? "watchlist"
        : "history";

    listEl.innerHTML = buildRailMarkup(items, listType);
    emptyEl.classList.add("hidden");
    if (sliderEl) {
      sliderEl.classList.remove("hidden");
    }
  }

  function matchesHistoryItem(item, cardEl) {
    const tmdbId = cardEl.dataset.tmdbId || "";
    const imdbId = cardEl.dataset.imdbId || "";
    const title = cardEl.dataset.title || "";
    const year = cardEl.dataset.year || "";

    if (tmdbId && String(item.tmdb_id || "") === tmdbId) {
      return true;
    }
    if (imdbId && String(item.imdb_id || item.imdbID || "") === imdbId) {
      return true;
    }

    const itemTitle = String(item.title || item.name || "");
    const itemYear = extractYear(item);
    return itemTitle === title && String(itemYear) === String(year);
  }

  async function removeCardItem(cardEl) {
    const listType = cardEl.dataset.listType || "";
    const imdbId = cardEl.dataset.imdbId || "";

    if (listType === "watchlist") {
      if (!supabaseClient || !currentUser || !imdbId) {
        return;
      }

      await supabaseClient
        .from("watchlist")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("imdb_id", imdbId);

      await refreshCollections();
      return;
    }

    if (listType === "favorites") {
      const favorites = readCollection("favorites");
      const next = favorites.filter((item) => !matchesHistoryItem(item, cardEl));
      writeCollection("favorites", next);
      await refreshCollections();
      return;
    }

    if (listType === "history") {
      const history = readCollection("history");
      const next = history.filter((item) => !matchesHistoryItem(item, cardEl));
      writeCollection("history", next);
      await refreshCollections();
    }
  }

  function buildMovieFromCard(cardEl) {
    const posterEl = cardEl.querySelector(".recon-poster");
    return {
      imdb_id: cardEl.dataset.imdbId || "",
      tmdb_id: cardEl.dataset.tmdbId || "",
      title: cardEl.dataset.title || "Untitled",
      year: cardEl.dataset.year || "",
      poster: posterEl ? posterEl.src : FALLBACK_POSTER,
      type: cardEl.dataset.mediaType === "tv" ? "tv" : "movie"
    };
  }

  async function addCardToWatchlist(cardEl) {
    if (!window.FiscusAuth || !window.FiscusAuth.addMovieToWatchlist) {
      return;
    }

    if (!window.FiscusAuth.isAuthenticated || !window.FiscusAuth.isAuthenticated()) {
      window.location.href = "login.html";
      return;
    }

    const movie = buildMovieFromCard(cardEl);
    if (!movie.imdb_id) {
      setSaveMessage("Cannot add to watchlist for this title (missing IMDB id).", true);
      return;
    }

    const result = await window.FiscusAuth.addMovieToWatchlist(movie);
    if (result && result.message) {
      setSaveMessage(result.message, !result.ok);
    }
    await refreshCollections();
  }

  async function addCardToFavorites(cardEl) {
    if (!window.FiscusAuth || !window.FiscusAuth.toggleFavoriteMovie) {
      return;
    }

    if (!window.FiscusAuth.isAuthenticated || !window.FiscusAuth.isAuthenticated()) {
      window.location.href = "login.html";
      return;
    }

    const movie = buildMovieFromCard(cardEl);
    if (!movie.imdb_id) {
      setSaveMessage("Cannot add to favorites for this title (missing IMDB id).", true);
      return;
    }

    if (window.FiscusAuth.isFavoriteMovie && window.FiscusAuth.isFavoriteMovie(movie.imdb_id)) {
      setSaveMessage("Already in favorites.", false);
      return;
    }

    const result = window.FiscusAuth.toggleFavoriteMovie(movie);
    if (result && result.message) {
      setSaveMessage(result.message, !result.ok);
    }
    await refreshCollections();
  }

  function openFromRailItem(itemEl) {
    const tmdbId = itemEl.dataset.tmdbId || "";
    const imdbId = itemEl.dataset.imdbId || "";
    const mediaType = itemEl.dataset.mediaType || "movie";

    if (tmdbId) {
      localStorage.setItem("tmdbMovieID", tmdbId);
      localStorage.setItem("tmdbMediaType", mediaType);
      localStorage.removeItem("movieID");
      localStorage.removeItem("selectedMovieID");
      window.location.href = `movies.html?tmdb=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(mediaType)}`;
      return;
    }

    if (imdbId) {
      localStorage.removeItem("tmdbMovieID");
      localStorage.removeItem("tmdbMediaType");
      localStorage.setItem("movieID", imdbId);
      localStorage.setItem("selectedMovieID", imdbId);
      window.location.href = `movies.html?movie=${encodeURIComponent(imdbId)}`;
    }
  }

  function attachRailClickHandlers() {
    [favoritesListEl, watchlistListEl, historyListEl].forEach((listEl) => {
      if (!listEl || listEl.dataset.bound === "true") {
        return;
      }

      listEl.addEventListener("click", (event) => {
        const actionBtn = event.target.closest("[data-action]");
        if (actionBtn) {
          event.preventDefault();
          event.stopPropagation();

          const cardEl = actionBtn.closest(".profile-rail-card");
          if (!cardEl) {
            return;
          }

          const action = actionBtn.dataset.action;
          if (action === "watch") {
            openFromRailItem(cardEl);
            return;
          }

          if (action === "remove") {
            removeCardItem(cardEl);
            return;
          }

          if (action === "watchlist") {
            addCardToWatchlist(cardEl);
            return;
          }

          if (action === "favorite") {
            addCardToFavorites(cardEl);
            return;
          }
        }

        const cardEl = event.target.closest(".profile-rail-card");
        if (!cardEl) {
          return;
        }
        openFromRailItem(cardEl);
      });

      listEl.dataset.bound = "true";
    });
  }

  function initRailSlider(prefix, listEl) {
    const prevBtn = document.getElementById(`profile-${prefix}-prev`);
    const nextBtn = document.getElementById(`profile-${prefix}-next`);
    const viewport = listEl ? listEl.parentElement : null;
    if (!prevBtn || !nextBtn || !viewport || !listEl) {
      return;
    }

    let index = 0;
    let lastGestureAt = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 40;
    const GESTURE_COOLDOWN_MS = 180;

    function getStep() {
      const firstItem = listEl.querySelector(".profile-rail-card");
      if (!firstItem) {
        return 0;
      }

      const itemWidth = firstItem.getBoundingClientRect().width;
      const styles = window.getComputedStyle(listEl);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return itemWidth + gap;
    }

    function getVisibleCount(step) {
      if (!step) {
        return 0;
      }
      return Math.max(1, Math.floor(viewport.clientWidth / step));
    }

    function updateSlider() {
      const cards = listEl.querySelectorAll(".profile-rail-card");
      const step = getStep();
      const visibleCount = getVisibleCount(step);
      const maxIndex = Math.max(0, cards.length - visibleCount);

      if (index > maxIndex) {
        index = maxIndex;
      }

      listEl.style.transform = `translateX(-${index * step}px)`;

      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= maxIndex;

      const shouldHide = cards.length <= visibleCount;
      prevBtn.classList.toggle("hidden", shouldHide);
      nextBtn.classList.toggle("hidden", shouldHide);
    }

    function slide(direction) {
      const step = getStep();
      const visibleCount = getVisibleCount(step);
      const cards = listEl.querySelectorAll(".profile-rail-card");
      const maxIndex = Math.max(0, cards.length - visibleCount);
      const jump = Math.max(1, visibleCount - 1);

      index = Math.min(maxIndex, Math.max(0, index + direction * jump));
      updateSlider();
    }

    function canHandleGesture() {
      const now = Date.now();
      if (now - lastGestureAt < GESTURE_COOLDOWN_MS) {
        return false;
      }

      lastGestureAt = now;
      return true;
    }

    prevBtn.addEventListener("click", () => slide(-1));
    nextBtn.addEventListener("click", () => slide(1));

    viewport.addEventListener("touchstart", (event) => {
      if (!event.touches || !event.touches.length) {
        return;
      }

      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }, { passive: true });

    viewport.addEventListener("touchend", (event) => {
      if (!event.changedTouches || !event.changedTouches.length) {
        return;
      }

      const deltaX = event.changedTouches[0].clientX - touchStartX;
      const deltaY = event.changedTouches[0].clientY - touchStartY;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      if (!canHandleGesture()) {
        return;
      }

      if (deltaX < 0) {
        slide(1);
      } else {
        slide(-1);
      }
    }, { passive: true });

    viewport.addEventListener("wheel", (event) => {
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : (event.shiftKey ? event.deltaY : 0);

      if (Math.abs(horizontalIntent) < 20) {
        return;
      }

      if (!canHandleGesture()) {
        return;
      }

      event.preventDefault();
      if (horizontalIntent > 0) {
        slide(1);
      } else {
        slide(-1);
      }
    }, { passive: false });

    window.addEventListener("resize", updateSlider);

    listEl.__profileSliderUpdate = updateSlider;
    updateSlider();
  }

  function updateRailSliders() {
    [favoritesListEl, watchlistListEl, historyListEl].forEach((listEl) => {
      if (listEl && typeof listEl.__profileSliderUpdate === "function") {
        listEl.__profileSliderUpdate();
      }
    });
  }

  async function loadWatchlistItems() {
    if (!supabaseClient || !currentUser) {
      return [];
    }

    const { data, error } = await supabaseClient
      .from("watchlist")
      .select("imdb_id, title, year, poster, type, added_at")
      .eq("user_id", currentUser.id)
      .order("added_at", { ascending: false });

    if (error) {
      return [];
    }

    return normalizeWatchlistItems(data || []);
  }

  function hydrateFormFromUser(user) {
    if (!formEl || !displayNameInput || !emailInput) {
      return;
    }

    const metadata = getUserMetadata(user);
    const displayName = metadata.display_name || metadata.full_name || user.email || "Guest User";
    const resolvedAvatar = resolveUserAvatar(user);

    displayNameInput.value = metadata.display_name || metadata.full_name || "";
    emailInput.value = user.email || "";

    if (nameHeading) {
      nameHeading.textContent = displayName;
    }

    if (memberSinceEl) {
      const createdAt = user.created_at ? new Date(user.created_at) : null;
      memberSinceEl.textContent = createdAt && !Number.isNaN(createdAt.getTime())
        ? String(createdAt.getFullYear())
        : "-";
    }

    if (avatarPreview) {
      avatarPreview.src = resolvedAvatar;
    }

    if (navProfileAvatar) {
      navProfileAvatar.src = resolvedAvatar;
      navProfileAvatar.classList.toggle("is-default", resolvedAvatar === FALLBACK_AVATAR);
    }
  }

  async function handleAvatarFileUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
      setSaveMessage("Please select a valid image file for icon.", true);
      return false;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSaveMessage("User icon must be smaller than 2MB.", true);
      return false;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        if (!dataUrl) {
          setSaveMessage("Could not read selected icon.", true);
          resolve(false);
          return;
        }

        pendingAvatarSource = dataUrl;

        if (avatarPreview) {
          avatarPreview.src = dataUrl;
        }

        if (navProfileAvatar) {
          navProfileAvatar.src = dataUrl;
          navProfileAvatar.classList.remove("is-default");
        }

        setSaveMessage("User icon preview updated. Click Save Profile to keep it.", false);
        resolve(true);
      };

      reader.onerror = () => {
        setSaveMessage("Failed to read icon file.", true);
        resolve(false);
      };

      reader.readAsDataURL(file);
    });
  }

  async function refreshCollections() {
    const favorites = normalizeLocalItems(
      window.FiscusAuth && window.FiscusAuth.getFavorites ? window.FiscusAuth.getFavorites() : []
    );
    let history = normalizeLocalItems(
      window.FiscusAuth && window.FiscusAuth.getSearchHistory ? window.FiscusAuth.getSearchHistory() : []
    );
    history = await hydrateMissingPosters(history);
    const watchlist = await loadWatchlistItems();

    updateCountSummary(watchlist, favorites, history);
    renderRail(favoritesListEl, favoritesEmptyEl, favorites);
    renderRail(watchlistListEl, watchlistEmptyEl, watchlist);
    renderRail(historyListEl, historyEmptyEl, history);
    updateRailSliders();
  }

  function resetSignedOutProfileUi() {
    currentUser = null;
    setStatus("Sign in to view your profile insights.");
    setSaveMessage("", false);

    if (formEl) {
      formEl.classList.add("hidden");
    }
    if (nameHeading) {
      nameHeading.textContent = "Guest User";
    }
    if (memberSinceEl) {
      memberSinceEl.textContent = "-";
    }
    if (displayNameInput) {
      displayNameInput.value = "";
    }
    if (emailInput) {
      emailInput.value = "";
    }
    if (avatarPreview) {
      avatarPreview.src = FALLBACK_AVATAR;
    }
    if (navProfileAvatar) {
      navProfileAvatar.src = FALLBACK_AVATAR;
      navProfileAvatar.classList.add("is-default");
    }
    if (profileImageSurface) {
      profileImageSurface.style.backgroundImage = "";
    }

    pendingBackdropSource = "";
    pendingAvatarSource = "";
    updateCountSummary([], [], []);
    renderRail(favoritesListEl, favoritesEmptyEl, []);
    renderRail(watchlistListEl, watchlistEmptyEl, []);
    renderRail(historyListEl, historyEmptyEl, []);
    updateRailSliders();
  }

  async function loadSession() {
    if (!supabaseClient) {
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setStatus("Could not load session.");
      setSaveMessage(error.message, true);
      await refreshCollections();
      return;
    }

    currentUser = data && data.session ? data.session.user : null;

    if (!currentUser) {
      resetSignedOutProfileUi();
      return;
    }

    setStatus(`Signed in as ${currentUser.email}`);
    if (formEl) {
      formEl.classList.remove("hidden");
    }

    hydrateFormFromUser(currentUser);
    await loadSavedBackdrop();
    await refreshCollections();
    pendingAvatarSource = "";
    setSaveMessage("", false);
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!supabaseClient || !currentUser) {
      setSaveMessage("Please sign in first.", true);
      return;
    }

    const displayName = displayNameInput ? displayNameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";

    const updates = {
      data: {
        display_name: displayName
      }
    };

    if (pendingBackdropSource) {
      updates.data.backdrop = pendingBackdropSource;
    }

    if (pendingAvatarSource) {
      updates.data.avatar_url = pendingAvatarSource;
      updates.data.picture = pendingAvatarSource;
    }

    if (email && email !== currentUser.email) {
      updates.email = email;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
    }

    setSaveMessage("Saving profile...", false);

    const { data, error } = await supabaseClient.auth.updateUser(updates);

    if (saveBtn) {
      saveBtn.disabled = false;
    }

    if (error) {
      setSaveMessage(error.message || "Could not save profile.", true);
      return;
    }

    currentUser = data && data.user ? data.user : currentUser;

    if (pendingBackdropSource) {
      if (!currentUser.user_metadata) {
        currentUser.user_metadata = {};
      }
      currentUser.user_metadata.backdrop = pendingBackdropSource;
      emitRealtimeAppEvent("backdrop:update", {
        userId: currentUser.id,
        backdrop: pendingBackdropSource
      });
      pendingBackdropSource = "";
    }

    if (pendingAvatarSource) {
      if (!currentUser.user_metadata) {
        currentUser.user_metadata = {};
      }
      currentUser.user_metadata.avatar_url = pendingAvatarSource;
      currentUser.user_metadata.picture = pendingAvatarSource;
      pendingAvatarSource = "";
    }

    setStatus(`Signed in as ${currentUser.email}`);
    hydrateFormFromUser(currentUser);

    if (updates.email) {
      setSaveMessage("Profile saved. Check your email to confirm the new address.", false);
    } else {
      setSaveMessage("Profile saved.", false);
    }
  }

  async function init() {
    if (!formEl) {
      return;
    }

    // Add scroll event listener for navbar color transition
    const navbar = document.getElementById('navbar');
    if (navbar) {
      const scrollHandler = () => {
        if (window.scrollY > 40) {
          navbar.classList.add('nav-colored');
        } else {
          navbar.classList.remove('nav-colored');
        }
      };
      window.addEventListener('scroll', scrollHandler, { passive: true });
      // Check initial scroll position in case page starts scrolled
      scrollHandler();
    }

    // Add event listener for change backdrop button
    if (changeBackdropBtn) {
      changeBackdropBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        changeBackdropBtn.disabled = true;
        changeBackdropBtn.textContent = "Changing...";
        
        const searchQuery = backdropSearchInput ? backdropSearchInput.value.trim() : "";
        let success = false;

        if (searchQuery) {
          // Search for specific movie
          success = await applyBackdropFromMovieSearch(searchQuery);
          if (!success) {
            setSaveMessage("Movie not found or has no backdrop.", true);
          } else {
            setSaveMessage("Backdrop updated successfully!", false);
            if (backdropSearchInput) {
              backdropSearchInput.value = "";
            }
          }
        } else {
          // Use random backdrop
          await applyRandomProfileBackdrop();
          success = true;
          setSaveMessage("Random backdrop previewed. Click Save Profile to keep it.", false);
        }

        changeBackdropBtn.disabled = false;
        changeBackdropBtn.textContent = "Change Poster";
      });
    }

    // Add event listener for pick random button
    if (pickRandomBtn) {
      pickRandomBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        pickRandomBtn.disabled = true;
        const spanEl = pickRandomBtn.querySelector('span');
        if (spanEl) spanEl.textContent = "Picking...";
        
        await applyRandomProfileBackdrop();
        setSaveMessage("Random backdrop previewed. Click Save Profile to keep it.", false);
        
        pickRandomBtn.disabled = false;
        if (spanEl) spanEl.textContent = "Pick Random";
      });
    }

    // Add event listener for upload backdrop button
    if (uploadBackdropBtn && backdropFileInput) {
      uploadBackdropBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdropFileInput.click();
      });

      backdropFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          uploadBackdropBtn.disabled = true;
          const spanEl = uploadBackdropBtn.querySelector('span');
          if (spanEl) spanEl.textContent = "Uploading...";
          await handleBackdropFileUpload(file);
          uploadBackdropBtn.disabled = false;
          if (spanEl) spanEl.textContent = "Upload";
          // Reset file input
          backdropFileInput.value = "";
        }
      });
    }

    if (changeIconBtn && iconFileInput) {
      changeIconBtn.addEventListener("click", (e) => {
        e.preventDefault();
        iconFileInput.click();
      });

      iconFileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          changeIconBtn.disabled = true;
          const spanEl = changeIconBtn.querySelector("span");
          if (spanEl) {
            spanEl.textContent = "Uploading...";
          }

          await handleAvatarFileUpload(file);

          changeIconBtn.disabled = false;
          if (spanEl) {
            spanEl.textContent = "Upload Icon";
          }
          iconFileInput.value = "";
        }
      });
    }

    attachRailClickHandlers();

    if (!slidersInitialized) {
      initRailSlider("favorites", favoritesListEl);
      initRailSlider("watchlist", watchlistListEl);
      initRailSlider("history", historyListEl);
      slidersInitialized = true;
    }

    if (!isConfigured()) {
      setStatus("Configure Supabase to enable profile settings.");
      setSaveMessage("Supabase is not configured.", true);
      await refreshCollections();
      return;
    }

    if (window.FiscusAuth && typeof window.FiscusAuth.ready === "function") {
      await window.FiscusAuth.ready();
    }

    supabaseClient = window.FiscusAuth && typeof window.FiscusAuth.getSupabaseClient === "function"
      ? window.FiscusAuth.getSupabaseClient()
      : null;

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
      );
    }

    formEl.addEventListener("submit", saveProfile);

    if (displayNameInput && nameHeading) {
      displayNameInput.addEventListener("input", () => {
        const value = displayNameInput.value.trim();
        nameHeading.textContent = value || (currentUser && currentUser.email) || "Guest User";
      });
    }

    await loadSession();

    supabaseClient.auth.onAuthStateChange(async () => {
      await loadSession();
    });

    document.addEventListener("fiscus:auth-signed-out", () => {
      resetSignedOutProfileUi();
    });

    if (window.FiscusRealtime && typeof window.FiscusRealtime.onAppEvent === "function") {
      window.FiscusRealtime.onAppEvent((payload) => {
        if (!payload || payload.type !== "backdrop:update") {
          return;
        }

        const details = payload.details || {};
        if (!currentUser || !details.userId || currentUser.id !== details.userId) {
          return;
        }

        if (!details.backdrop || !profileImageSurface) {
          return;
        }

        profileImageSurface.style.backgroundImage = `url("${details.backdrop}")`;
        lastBackdropPath = details.backdrop;
        setSaveMessage("Backdrop updated from another tab.", false);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
