(function () {
  const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='31' fill='%231b263b'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23ebebea'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23ebebea'/%3E%3C/svg%3E";

  const statusEl = document.getElementById("auth-status");
  const loginBtn = document.getElementById("login-btn") || document.getElementById("profile-login-btn");
  const logoutBtn = document.getElementById("logout-btn") || document.getElementById("profile-logout-btn");
  const profileLink = document.getElementById("profile-link");
  const profileAvatar = profileLink ? profileLink.querySelector(".profile-avatar") : null;
  const watchlistGrid = document.getElementById("watchlist-grid");
  const watchlistEmpty = document.getElementById("watchlist-empty");
  const watchlistLoading = document.getElementById("watchlist-loading");
  const SEARCH_HISTORY_LIMIT = 30;

  let supabaseClient = null;
  let currentUser = null;

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

  function setAuthStatus(message) {
    if (statusEl) {
      statusEl.textContent = message;
      if (message) {
        statusEl.classList.remove("hidden");
      } else {
        statusEl.classList.add("hidden");
      }
    }
  }

  function resolveUserAvatar(user) {
    if (!user) {
      return "";
    }

    const metadata = user.user_metadata || {};
    return metadata.avatar_url || metadata.picture || "";
  }

  function updateProfileAvatar(avatarUrl) {
    if (!profileAvatar) {
      return;
    }

    const nextAvatar = avatarUrl || FALLBACK_AVATAR;
    const isDefault = !avatarUrl;

    profileAvatar.src = nextAvatar;
    profileAvatar.classList.toggle("is-default", isDefault);
  }

  function toggleAuthButtons(loggedIn) {
    if (!loginBtn || !logoutBtn) {
      return;
    }

    if (loggedIn) {
      loginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
    } else {
      loginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
    }
  }

  function setLoading(isLoading) {
    if (!watchlistLoading) {
      return;
    }

    if (isLoading) {
      watchlistLoading.classList.remove("hidden");
    } else {
      watchlistLoading.classList.add("hidden");
    }
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
      console.warn(`Invalid ${collectionName} storage payload`, error);
      return [];
    }
  }

  function writeCollection(collectionName, items) {
    localStorage.setItem(getCollectionStorageKey(collectionName), JSON.stringify(items));
  }

  function getFavorites() {
    return readCollection("favorites");
  }

  function getSearchHistory() {
    return readCollection("history");
  }

  function isFavoriteMovie(movieId) {
    if (!movieId) {
      return false;
    }

    return getFavorites().some((item) => item.imdb_id === movieId);
  }

  function toggleFavoriteMovie(movie) {
    if (!movie || !movie.imdb_id) {
      return { ok: false, liked: false, message: "Invalid movie data." };
    }

    const favorites = getFavorites();
    const existingIndex = favorites.findIndex((item) => item.imdb_id === movie.imdb_id);

    if (existingIndex >= 0) {
      favorites.splice(existingIndex, 1);
      writeCollection("favorites", favorites);
      return { ok: true, liked: false, message: "Removed from favorites." };
    }

    favorites.unshift({
      imdb_id: movie.imdb_id,
      title: movie.title,
      year: movie.year,
      poster: movie.poster,
      tmdb_id: movie.tmdb_id || null,
      added_at: new Date().toISOString()
    });

    writeCollection("favorites", favorites.slice(0, SEARCH_HISTORY_LIMIT));
    return { ok: true, liked: true, message: "Added to favorites." };
  }

  function addSearchHistory(entry) {
    if (!entry) {
      return;
    }

    const nextEntry = {
      tmdb_id: entry.tmdb_id || null,
      imdb_id: entry.imdb_id || null,
      title: entry.title || "Unknown",
      year: entry.year || "N/A",
      searched_at: new Date().toISOString()
    };

    const history = getSearchHistory();
    const dedupeKey = nextEntry.tmdb_id || nextEntry.imdb_id || `${nextEntry.title}:${nextEntry.year}`;
    const deduped = history.filter((item) => {
      const itemKey = item.tmdb_id || item.imdb_id || `${item.title}:${item.year}`;
      return itemKey !== dedupeKey;
    });

    deduped.unshift(nextEntry);
    writeCollection("history", deduped.slice(0, SEARCH_HISTORY_LIMIT));
  }

  async function fetchWatchlist() {
    if (!supabaseClient || !currentUser) {
      return [];
    }

    const { data, error } = await supabaseClient
      .from("watchlist")
      .select("id, imdb_id, title, year, poster, type, added_at")
      .eq("user_id", currentUser.id)
      .order("added_at", { ascending: false });

    if (error) {
      console.error("Failed to load watchlist:", error.message);
      return [];
    }

    return data || [];
  }

  function openMovieDetails(imdbId) {
    localStorage.setItem("movieID", imdbId);
    window.location.href = "movies.html";
  }

  function renderWatchlistItems(items) {
    if (!watchlistGrid || !watchlistEmpty) {
      return;
    }

    watchlistGrid.innerHTML = "";

    if (!currentUser) {
      watchlistEmpty.textContent = "Sign in to view your watchlist.";
      watchlistEmpty.classList.remove("hidden");
      return;
    }

    if (!items.length) {
      watchlistEmpty.textContent = "No movies in your watchlist yet.";
      watchlistEmpty.classList.remove("hidden");
      return;
    }

    watchlistEmpty.classList.add("hidden");

    items.forEach((movie) => {
      const card = document.createElement("article");
      card.className = "watchlist-card";

      const poster = movie.poster && movie.poster !== "N/A" ? movie.poster : "https://via.placeholder.com/300x450?text=No+Poster";

      card.innerHTML = `
        <img class="watchlist-card-image" src="${poster}" alt="${movie.title}">
        <div class="watchlist-card-overlay">
          <h3>${movie.title}</h3>
          <p>${movie.year || "Unknown Year"} • ${(movie.type || "movie").toUpperCase()}</p>
          <div class="watchlist-card-actions">
            <button class="watchlist-card-btn" data-open="${movie.imdb_id}">Watch Now</button>
            <button class="watchlist-card-btn watchlist-card-btn-remove" data-remove="${movie.imdb_id}">Remove</button>
          </div>
        </div>
      `;

      watchlistGrid.appendChild(card);
    });

    watchlistGrid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openMovieDetails(btn.dataset.open));
    });

    watchlistGrid.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await removeMovieFromWatchlist(btn.dataset.remove);
      });
    });
  }

  async function refreshWatchlist() {
    if (!watchlistGrid) {
      return;
    }

    setLoading(true);
    const items = await fetchWatchlist();
    setLoading(false);
    renderWatchlistItems(items);
  }

  async function signInWithGoogle() {
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.SUPABASE_CONFIG.redirectTo
      }
    });
  }

  async function signOut() {
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signOut();
  }

  async function addMovieToWatchlist(movie) {
    if (!supabaseClient || !currentUser) {
      return { ok: false, message: "Please sign in first." };
    }

    const payload = {
      user_id: currentUser.id,
      imdb_id: movie.imdb_id,
      title: movie.title,
      year: movie.year,
      poster: movie.poster,
      type: movie.type
    };

    const { error } = await supabaseClient
      .from("watchlist")
      .upsert(payload, { onConflict: "user_id,imdb_id", ignoreDuplicates: false });

    if (error) {
      console.error("Add watchlist failed:", error.message);
      return { ok: false, message: "Could not add movie to watchlist." };
    }

    await refreshWatchlist();
    return { ok: true, message: "Added to watchlist." };
  }

  async function removeMovieFromWatchlist(imdbId) {
    if (!supabaseClient || !currentUser) {
      return;
    }

    const { error } = await supabaseClient
      .from("watchlist")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("imdb_id", imdbId);

    if (error) {
      console.error("Remove watchlist failed:", error.message);
      return;
    }

    await refreshWatchlist();
  }

  async function updateSessionState() {
    if (!supabaseClient) {
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    currentUser = data && data.session ? data.session.user : null;

    if (currentUser) {
      setAuthStatus(`Signed in as ${currentUser.email}`);
      if (profileLink) {
        profileLink.setAttribute("title", `Signed in as ${currentUser.email}`);
      }
      updateProfileAvatar(resolveUserAvatar(currentUser));
      toggleAuthButtons(true);
      await refreshWatchlist();
    } else {
      setAuthStatus("Not signed in");
      if (profileLink) {
        profileLink.setAttribute("title", "Open profile");
      }
      updateProfileAvatar("");
      toggleAuthButtons(false);
      renderWatchlistItems([]);
    }
  }

  async function init() {
    if (!isConfigured()) {
      setAuthStatus("");
      updateProfileAvatar("");
      if (loginBtn) {
        loginBtn.textContent = "Login";
        loginBtn.disabled = true;
      }
      if (logoutBtn) {
        logoutBtn.classList.add("hidden");
      }
      if (watchlistEmpty) {
        watchlistEmpty.textContent = "Configure Supabase to use watchlist.";
      }
      return;
    }

    if (loginBtn) {
      loginBtn.disabled = false;
    }

    supabaseClient = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );

    if (loginBtn) {
      loginBtn.addEventListener("click", async () => {
        await signInWithGoogle();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", signOut);
    }

    await updateSessionState();

    supabaseClient.auth.onAuthStateChange(async () => {
      await updateSessionState();
    });
  }

  window.FiscusAuth = {
    addMovieToWatchlist,
    refreshWatchlist,
    signInWithGoogle,
    signOut,
    getFavorites,
    getSearchHistory,
    isFavoriteMovie,
    toggleFavoriteMovie,
    addSearchHistory
  };

  document.addEventListener("DOMContentLoaded", init);
})();
