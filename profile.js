(function () {
  const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='31' fill='%231b263b'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23ebebea'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23ebebea'/%3E%3C/svg%3E";
  const FALLBACK_POSTER = "https://via.placeholder.com/500x750?text=No+Poster";

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

  let supabaseClient = null;
  let currentUser = null;
  let slidersInitialized = false;

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

  function buildRailMarkup(items) {
    return items.map((item) => {
      const safeTitle = escapeHtml(item.title || "Untitled");
      const safePoster = escapeHtml(item.poster || FALLBACK_POSTER);
      const safeYear = escapeHtml(item.year || "");
      const safeTmdb = escapeHtml(item.tmdb_id || "");
      const safeImdb = escapeHtml(item.imdb_id || "");
      const safeMedia = escapeHtml(item.media_type || "movie");

      return `
        <li class="movie-poster-box profile-rail-card" data-tmdb-id="${safeTmdb}" data-imdb-id="${safeImdb}" data-media-type="${safeMedia}">
          <img class="recon-poster" src="${safePoster}" alt="${safeTitle} poster" loading="lazy">
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

    listEl.innerHTML = buildRailMarkup(items);
    emptyEl.classList.add("hidden");
    if (sliderEl) {
      sliderEl.classList.remove("hidden");
    }
  }

  function openFromRailItem(itemEl) {
    const tmdbId = itemEl.dataset.tmdbId || "";
    const imdbId = itemEl.dataset.imdbId || "";
    const mediaType = itemEl.dataset.mediaType || "movie";

    if (tmdbId) {
      localStorage.setItem("tmdbMovieID", tmdbId);
      localStorage.setItem("tmdbMediaType", mediaType);
      window.location.href = "movies.html";
      return;
    }

    if (imdbId) {
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

    prevBtn.addEventListener("click", () => slide(-1));
    nextBtn.addEventListener("click", () => slide(1));
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
      .select("movie_id, imdb_id, title, year, poster_url, added_at")
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
  }

  async function refreshCollections() {
    const favorites = normalizeLocalItems(
      window.FiscusAuth && window.FiscusAuth.getFavorites ? window.FiscusAuth.getFavorites() : []
    );
    const history = normalizeLocalItems(
      window.FiscusAuth && window.FiscusAuth.getSearchHistory ? window.FiscusAuth.getSearchHistory() : []
    );
    const watchlist = await loadWatchlistItems();

    updateCountSummary(watchlist, favorites, history);
    renderRail(favoritesListEl, favoritesEmptyEl, favorites);
    renderRail(watchlistListEl, watchlistEmptyEl, watchlist);
    renderRail(historyListEl, historyEmptyEl, history);
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
      setStatus("Sign in to view your profile insights.");
      if (formEl) {
        formEl.classList.add("hidden");
      }
      if (nameHeading) {
        nameHeading.textContent = "Guest User";
      }
      if (memberSinceEl) {
        memberSinceEl.textContent = "-";
      }
      if (avatarPreview) {
        avatarPreview.src = FALLBACK_AVATAR;
      }
      await refreshCollections();
      return;
    }

    setStatus(`Signed in as ${currentUser.email}`);
    if (formEl) {
      formEl.classList.remove("hidden");
    }

    hydrateFormFromUser(currentUser);
    await refreshCollections();
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

    supabaseClient = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );

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
  }

  document.addEventListener("DOMContentLoaded", init);
})();
