(function () {
  const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='31' fill='%231b263b'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23ebebea'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23ebebea'/%3E%3C/svg%3E";

  const statusEl = document.getElementById("auth-status");
  const loginBtn = document.getElementById("login-btn") || document.getElementById("profile-login-btn");
  const logoutBtn = document.getElementById("logout-btn") || document.getElementById("profile-logout-btn");
  const authForm = document.getElementById("auth-form");
  const authTitle = document.getElementById("auth-title");
  const authTogglePrefix = document.getElementById("auth-toggle-prefix");
  const authModeToggle = document.getElementById("auth-mode-toggle");
  const authNameRow = document.getElementById("auth-name-row");
  const firstNameInput = document.getElementById("auth-first-name");
  const lastNameInput = document.getElementById("auth-last-name");
  const authEmailInput = document.getElementById("auth-email");
  const authPasswordInput = document.getElementById("auth-password");
  const authTermsRow = document.getElementById("auth-terms-row");
  const authTermsCheckbox = document.getElementById("auth-terms");
  const authSubmitBtn = document.getElementById("auth-submit-btn");
  const resendVerifyBtn = document.getElementById("resend-verify-btn");
  const facebookBtn = document.getElementById("facebook-btn");
  const profileLink = document.getElementById("profile-link");
  const profileAvatar = profileLink ? profileLink.querySelector(".profile-avatar") : null;
  const watchlistGrid = document.getElementById("watchlist-grid");
  const watchlistViewport = watchlistGrid ? watchlistGrid.parentElement : null;
  const watchlistPrevBtn = document.getElementById("watchlist-prev-slide");
  const watchlistNextBtn = document.getElementById("watchlist-next-slide");
  const watchlistEmpty = document.getElementById("watchlist-empty");
  const watchlistLoading = document.getElementById("watchlist-loading");
  const SEARCH_HISTORY_LIMIT = 30;
  const WATCHLIST_ACTION_ICONS = {
    watch: "/assets/play-512.png",
    watchlist: "/assets/plus-2-512.png",
    favorite: "/assets/favorite-2-512.png",
    remove: "/assets/trash-2-512.png"
  };

  let supabaseClient = null;
  let currentUser = null;
  let favoritesCache = [];
  let searchHistoryCache = [];
  let authMode = "signup";
  let pendingVerificationEmail = "";
  let resolveAuthReady = null;
  const authReady = new Promise((resolve) => {
    resolveAuthReady = resolve;
  });

  function finishAuthReady() {
    if (resolveAuthReady) {
      resolveAuthReady();
      resolveAuthReady = null;
    }
  }

  function getSupabaseClient() {
    return supabaseClient;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function waitUntilReady() {
    return authReady;
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

  function emitRealtimeAuthEvent(type, details) {
    if (!window.FiscusRealtime || typeof window.FiscusRealtime.emitAuthEvent !== "function") {
      return;
    }

    window.FiscusRealtime.emitAuthEvent(type, details || {});
  }

  function emitRealtimeAppEvent(type, details) {
    if (!window.FiscusRealtime || typeof window.FiscusRealtime.emitAppEvent !== "function") {
      return;
    }

    window.FiscusRealtime.emitAppEvent(type, details || {});
  }

  function showResendVerificationButton(show) {
    if (!resendVerifyBtn) {
      return;
    }

    resendVerifyBtn.classList.toggle("hidden", !show);
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

  function updateProfileLinkDestination(loggedIn) {
    if (!profileLink) {
      return;
    }

    profileLink.setAttribute("href", loggedIn ? "profile.html" : "login.html");
  }

  function getSupabaseProjectRef() {
    try {
      const host = new URL(window.SUPABASE_CONFIG.url).hostname;
      return host.split(".")[0] || "";
    } catch (_) {
      return "";
    }
  }

  function clearSupabaseAuthStorage() {
    const projectRef = getSupabaseProjectRef();
    const knownKeys = [
      projectRef ? `sb-${projectRef}-auth-token` : "",
      projectRef ? `sb-${projectRef}-auth-token-code-verifier` : "",
      "supabase.auth.token"
    ].filter(Boolean);

    [window.localStorage, window.sessionStorage].forEach((storage) => {
      if (!storage) {
        return;
      }

      knownKeys.forEach((key) => storage.removeItem(key));

      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (!key) {
          continue;
        }

        const isSupabaseAuthKey = key.startsWith("sb-") && (
          key.includes("-auth-token") ||
          key.includes("code-verifier")
        );

        if (isSupabaseAuthKey) {
          storage.removeItem(key);
        }
      }
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function hasEmailAuthForm() {
    return Boolean(authForm && authEmailInput && authPasswordInput && authSubmitBtn);
  }

  function setAuthMode(mode) {
    authMode = mode === "signin" ? "signin" : "signup";
    if (!hasEmailAuthForm()) {
      return;
    }

    const signingIn = authMode === "signin";

    if (authTitle) {
      authTitle.textContent = signingIn ? "Sign in" : "Create an account";
    }
    if (authTogglePrefix) {
      authTogglePrefix.textContent = signingIn ? "Need an account?" : "Already have an account?";
    }
    if (authModeToggle) {
      authModeToggle.textContent = signingIn ? "Create account" : "Log in";
    }
    if (authSubmitBtn) {
      authSubmitBtn.textContent = signingIn ? "Sign in" : "Create account";
    }

    if (authNameRow) {
      authNameRow.classList.toggle("hidden", signingIn);
    }
    if (authTermsRow) {
      authTermsRow.classList.toggle("hidden", signingIn);
    }

    if (firstNameInput) {
      firstNameInput.required = !signingIn;
    }
    if (lastNameInput) {
      lastNameInput.required = !signingIn;
    }
    if (authTermsCheckbox) {
      authTermsCheckbox.required = !signingIn;
    }
    if (authPasswordInput) {
      authPasswordInput.setAttribute("autocomplete", signingIn ? "current-password" : "new-password");
    }

    if (!signingIn) {
      pendingVerificationEmail = "";
      showResendVerificationButton(false);
    }
  }

  async function resendVerificationEmail(email) {
    if (!supabaseClient) {
      return { ok: false, message: "Auth is not configured." };
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return { ok: false, message: "Enter your email first." };
    }

    const { error } = await supabaseClient.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.SUPABASE_CONFIG.redirectTo
      }
    });

    if (error) {
      return { ok: false, message: error.message || "Could not resend verification email." };
    }

    return { ok: true, message: "Verification email sent. Check your inbox and spam folder." };
  }

  async function signInWithEmailPassword(email, password) {
    if (!supabaseClient) {
      return { ok: false, message: "Auth is not configured." };
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      return { ok: false, message: error.message || "Could not sign in." };
    }

    return { ok: true, user: data.user };
  }

  async function signUpWithEmailPassword(payload) {
    if (!supabaseClient) {
      return { ok: false, message: "Auth is not configured." };
    }

    const fullName = `${payload.firstName} ${payload.lastName}`.trim();
    const normalizedEmail = String(payload.email || "").trim().toLowerCase();
    const { data, error } = await supabaseClient.auth.signUp({
      email: normalizedEmail,
      password: payload.password,
      options: {
        emailRedirectTo: window.SUPABASE_CONFIG.redirectTo,
        data: {
          first_name: payload.firstName,
          last_name: payload.lastName,
          full_name: fullName,
          display_name: fullName
        }
      }
    });

    if (error) {
      return { ok: false, message: error.message || "Could not create account." };
    }

    return {
      ok: true,
      needsEmailConfirm: !(data && data.session),
      user: data ? data.user : null
    };
  }

  async function handleEmailAuthSubmit(event) {
    event.preventDefault();

    if (!supabaseClient) {
      setAuthStatus("Supabase is not configured.");
      return;
    }

    const email = authEmailInput ? authEmailInput.value.trim() : "";
    const password = authPasswordInput ? authPasswordInput.value : "";

    if (!email || !password) {
      setAuthStatus("Enter email and password.");
      emitRealtimeAuthEvent("submit:error", { mode: authMode, reason: "missing_credentials" });
      return;
    }

    if (authSubmitBtn) {
      authSubmitBtn.disabled = true;
    }

    if (authMode === "signin") {
      setAuthStatus("Signing in...");
      emitRealtimeAuthEvent("submit:start", { mode: "signin" });
      const result = await signInWithEmailPassword(email, password);
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
      }

      if (!result.ok) {
        emitRealtimeAuthEvent("submit:error", { mode: "signin", reason: "signin_failed" });
        const rawMessage = String(result.message || "");
        if (rawMessage.toLowerCase().includes("invalid login credentials")) {
          setAuthStatus("Invalid credentials. If you just created this account, confirm your email first, then try again.");
          pendingVerificationEmail = email;
          showResendVerificationButton(true);
        } else {
          setAuthStatus(rawMessage);
          showResendVerificationButton(false);
        }
        return;
      }

      setAuthStatus("Signed in. Redirecting to profile...");
      emitRealtimeAuthEvent("submit:success", { mode: "signin" });
      showResendVerificationButton(false);
      window.location.href = "profile.html";
      return;
    }

    const firstName = firstNameInput ? firstNameInput.value.trim() : "";
    const lastName = lastNameInput ? lastNameInput.value.trim() : "";

    if (!firstName || !lastName) {
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
      }
      setAuthStatus("Enter your first and last name.");
      emitRealtimeAuthEvent("submit:error", { mode: "signup", reason: "missing_name" });
      return;
    }

    if (authTermsCheckbox && !authTermsCheckbox.checked) {
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
      }
      setAuthStatus("You must accept the terms to create an account.");
      emitRealtimeAuthEvent("submit:error", { mode: "signup", reason: "terms_required" });
      return;
    }

    setAuthStatus("Creating account...");
    emitRealtimeAuthEvent("submit:start", { mode: "signup" });
    const result = await signUpWithEmailPassword({ firstName, lastName, email, password });

    if (authSubmitBtn) {
      authSubmitBtn.disabled = false;
    }

    if (!result.ok) {
      setAuthStatus(result.message);
      emitRealtimeAuthEvent("submit:error", { mode: "signup", reason: "signup_failed" });
      return;
    }

    if (result.needsEmailConfirm) {
      setAuthStatus("Account created! Check your email (and spam folder) for a verification link. Click it to confirm, then sign in here.");
      emitRealtimeAuthEvent("submit:success", { mode: "signup", verification: "pending" });
      pendingVerificationEmail = email;
      showResendVerificationButton(true);
      setAuthMode("signin");
      return;
    }

    setAuthStatus("Account created. Redirecting to profile...");
    emitRealtimeAuthEvent("submit:success", { mode: "signup", verification: "complete" });
    showResendVerificationButton(false);
    window.location.href = "profile.html";
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

  function getFavorites() {
    return favoritesCache.slice();
  }

  function getSearchHistory() {
    return searchHistoryCache.slice();
  }

  function isFavoriteMovie(movieId) {
    if (!movieId) {
      return false;
    }

    return getFavorites().some((item) => item.imdb_id === movieId);
  }

  async function loadFavoritesFromSupabase() {
    if (!supabaseClient || !currentUser) {
      favoritesCache = [];
      return favoritesCache;
    }

    const { data, error } = await supabaseClient
      .from("favorites")
      .select("imdb_id, tmdb_id, title, year, poster, added_at")
      .eq("user_id", currentUser.id)
      .order("added_at", { ascending: false });

    if (error) {
      console.error("Failed to load favorites:", error.message);
      favoritesCache = [];
      return favoritesCache;
    }

    favoritesCache = (data || []).slice(0, SEARCH_HISTORY_LIMIT);
    return getFavorites();
  }

  async function loadSearchHistoryFromSupabase() {
    if (!supabaseClient || !currentUser) {
      searchHistoryCache = [];
      return searchHistoryCache;
    }

    const { data, error } = await supabaseClient
      .from("search_history")
      .select("tmdb_id, imdb_id, title, year, poster, media_type, searched_at")
      .eq("user_id", currentUser.id)
      .order("searched_at", { ascending: false });

    if (error) {
      console.error("Failed to load search history:", error.message);
      searchHistoryCache = [];
      return searchHistoryCache;
    }

    searchHistoryCache = (data || []).slice(0, SEARCH_HISTORY_LIMIT);
    return getSearchHistory();
  }

  async function refreshProfileCollections() {
    try {
      await Promise.all([
        loadFavoritesFromSupabase(),
        loadSearchHistoryFromSupabase()
      ]);
    } catch (error) {
      console.error("Profile collection refresh failed:", error);
    }

    return {
      favorites: getFavorites(),
      history: getSearchHistory()
    };
  }

  async function removeFavoriteMovie(movieId) {
    if (!supabaseClient || !currentUser || !movieId) {
      return { ok: false, message: "Please sign in first." };
    }

    const { error } = await supabaseClient
      .from("favorites")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("imdb_id", movieId);

    if (error) {
      console.error("Remove favorite failed:", error.message);
      return { ok: false, message: "Could not remove favorite." };
    }

    favoritesCache = favoritesCache.filter((item) => item.imdb_id !== movieId);
    emitRealtimeAppEvent("favorite:toggle", {
      userId: currentUser.id,
      imdbId: movieId,
      liked: false
    });
    return { ok: true, liked: false, message: "Removed from favorites." };
  }

  async function toggleFavoriteMovie(movie) {
    if (!movie || !movie.imdb_id) {
      return { ok: false, liked: false, message: "Invalid movie data." };
    }

    if (!supabaseClient || !currentUser) {
      return { ok: false, liked: false, message: "Please sign in first." };
    }

    const favorites = getFavorites();
    const existingIndex = favorites.findIndex((item) => item.imdb_id === movie.imdb_id);

    if (existingIndex >= 0) {
      return removeFavoriteMovie(movie.imdb_id);
    }

    const payload = {
      user_id: currentUser.id,
      imdb_id: movie.imdb_id,
      title: movie.title,
      year: movie.year,
      poster: movie.poster,
      tmdb_id: movie.tmdb_id || null,
      added_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
      .from("favorites")
      .upsert(payload, { onConflict: "user_id,imdb_id", ignoreDuplicates: false });

    if (error) {
      console.error("Add favorite failed:", error.message);
      return { ok: false, liked: false, message: "Could not add favorite." };
    }

    favoritesCache = [payload, ...favorites.filter((item) => item.imdb_id !== movie.imdb_id)]
      .slice(0, SEARCH_HISTORY_LIMIT);
    emitRealtimeAppEvent("favorite:toggle", {
      userId: currentUser.id,
      imdbId: movie.imdb_id,
      liked: true
    });
    return { ok: true, liked: true, message: "Added to favorites." };
  }

  async function saveSearchHistory(entry) {
    if (!entry) {
      return { ok: false };
    }

    if (!supabaseClient || !currentUser) {
      return { ok: false, message: "Please sign in first." };
    }

    const nextEntry = {
      user_id: currentUser.id,
      tmdb_id: entry.tmdb_id || null,
      imdb_id: entry.imdb_id || null,
      title: entry.title || "Unknown",
      year: entry.year || "N/A",
      poster: entry.poster || entry.poster_path || "",
      media_type: entry.media_type || "movie",
      searched_at: new Date().toISOString()
    };

    const dedupeKey = nextEntry.tmdb_id || nextEntry.imdb_id || `${nextEntry.title}:${nextEntry.year}`;
    let deleteQuery = supabaseClient
      .from("search_history")
      .delete()
      .eq("user_id", currentUser.id);

    if (nextEntry.tmdb_id) {
      deleteQuery = deleteQuery.eq("tmdb_id", nextEntry.tmdb_id);
    } else if (nextEntry.imdb_id) {
      deleteQuery = deleteQuery.eq("imdb_id", nextEntry.imdb_id);
    } else {
      deleteQuery = deleteQuery
        .eq("title", nextEntry.title)
        .eq("year", nextEntry.year);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.error("Search history dedupe failed:", deleteError.message);
      return { ok: false, message: "Could not update search history." };
    }

    const { error } = await supabaseClient
      .from("search_history")
      .upsert(nextEntry);

    if (error) {
      console.error("Add search history failed:", error.message);
      return { ok: false, message: "Could not update search history." };
    }

    const deduped = getSearchHistory().filter((item) => {
      const itemKey = item.tmdb_id || item.imdb_id || `${item.title}:${item.year}`;
      return itemKey !== dedupeKey;
    });

    searchHistoryCache = [nextEntry, ...deduped].slice(0, SEARCH_HISTORY_LIMIT);
    return { ok: true };
  }

  async function addSearchHistory(entry) {
    await waitUntilReady();
    return saveSearchHistory(entry);
  }

  async function removeSearchHistoryItem(item) {
    if (!supabaseClient || !currentUser || !item) {
      return { ok: false, message: "Please sign in first." };
    }

    let query = supabaseClient
      .from("search_history")
      .delete()
      .eq("user_id", currentUser.id);

    if (item.tmdb_id) {
      query = query.eq("tmdb_id", item.tmdb_id);
    } else if (item.imdb_id) {
      query = query.eq("imdb_id", item.imdb_id);
    } else {
      query = query
        .eq("title", item.title || "Untitled")
        .eq("year", item.year || "");
    }

    const { error } = await query;
    if (error) {
      console.error("Remove search history failed:", error.message);
      return { ok: false, message: "Could not remove history item." };
    }

    const targetKey = item.tmdb_id || item.imdb_id || `${item.title || "Untitled"}:${item.year || ""}`;
    searchHistoryCache = searchHistoryCache.filter((historyItem) => {
      const itemKey = historyItem.tmdb_id || historyItem.imdb_id || `${historyItem.title}:${historyItem.year}`;
      return itemKey !== targetKey;
    });

    return { ok: true, message: "Removed from history." };
  }

  function isAuthenticated() {
    return Boolean(currentUser);
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
    localStorage.removeItem("tmdbMovieID");
    localStorage.removeItem("tmdbMediaType");
    window.location.href = "movies.html";
  }

  function buildWatchlistMoviePayload(cardEl) {
    if (!cardEl) {
      return null;
    }

    const posterEl = cardEl.querySelector(".recon-poster");
    return {
      imdb_id: cardEl.dataset.imdbId || "",
      tmdb_id: cardEl.dataset.tmdbId || "",
      title: cardEl.dataset.movieTitle || "Untitled",
      year: cardEl.dataset.movieYear || "",
      poster: posterEl ? posterEl.src : "",
      type: cardEl.dataset.movieType || "movie"
    };
  }

  async function handleWatchlistGridAction(actionBtn) {
    if (!actionBtn) {
      return;
    }

    const cardEl = actionBtn.closest(".watchlist-card");
    if (!cardEl) {
      return;
    }

    const action = actionBtn.dataset.action || "";
    const imdbId = cardEl.dataset.imdbId || "";

    if (action === "watch") {
      if (imdbId) {
        openMovieDetails(imdbId);
      }
      return;
    }

    if (action === "remove") {
      if (imdbId) {
        await removeMovieFromWatchlist(imdbId);
      }
      return;
    }

    if (action === "watchlist") {
      const payload = buildWatchlistMoviePayload(cardEl);
      if (!payload || !payload.imdb_id) {
        setAuthStatus("Could not add this title to watchlist.");
        return;
      }

      const result = await addMovieToWatchlist(payload);
      if (result && result.message) {
        setAuthStatus(result.message);
      }
      return;
    }

    if (action === "favorite") {
      const payload = buildWatchlistMoviePayload(cardEl);
      if (!payload || !payload.imdb_id) {
        setAuthStatus("Could not update favorites for this title.");
        return;
      }

      const result = await toggleFavoriteMovie(payload);
      if (result && result.ok) {
        actionBtn.setAttribute("aria-pressed", result.liked ? "true" : "false");
      }
      if (result && result.message) {
        setAuthStatus(result.message);
      }
    }
  }

  async function fetchRandomMovies() {
    try {
      const randomPage = Math.floor(Math.random() * 50) + 1;
      const response = await fetch(
        `/api/tmdb/movie/popular?language=en-US&page=${randomPage}`
      );

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const data = await response.json();
      const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
      
      return data.results.slice(0, 12).map(movie => ({
        id: movie.id,
        tmdb_id: movie.id,
        title: movie.title,
        year: movie.release_date ? movie.release_date.split('-')[0] : 'Unknown',
        poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : "https://via.placeholder.com/300x450?text=No+Poster",
        type: 'movie'
      }));
    } catch (error) {
      console.error("Failed to fetch random movies:", error);
      return [];
    }
  }

  function updateWatchlistSliderVisibility() {
    if (!watchlistGrid || !watchlistViewport || !watchlistPrevBtn || !watchlistNextBtn) {
      return;
    }

    if (!watchlistGrid.children.length) {
      watchlistPrevBtn.classList.add("hidden");
      watchlistNextBtn.classList.add("hidden");
      watchlistGrid.style.transform = "translateX(0px)";
      return;
    }

    const needsScroll = watchlistGrid.scrollWidth > (watchlistViewport.clientWidth + 1);
    watchlistPrevBtn.classList.toggle("hidden", !needsScroll);
    watchlistNextBtn.classList.toggle("hidden", !needsScroll);

    if (!needsScroll) {
      watchlistGrid.style.transform = "translateX(0px)";
    }
  }

  function renderWatchlistItems(items) {
    if (!watchlistGrid || !watchlistEmpty) {
      return;
    }

    watchlistGrid.innerHTML = "";

    const existingOverlay = watchlistGrid.parentElement
      ? watchlistGrid.parentElement.querySelector(".watchlist-center-message")
      : null;
    if (existingOverlay) {
      existingOverlay.remove();
    }

    if (!currentUser) {
      watchlistEmpty.classList.add("hidden");
      
      // Fetch and render random movies with blur overlay
      fetchRandomMovies().then(randomMovies => {
        if (randomMovies.length === 0) {
          watchlistEmpty.textContent = "Log in to add movies to your watchlist.";
          watchlistEmpty.classList.remove("hidden");
          return;
        }

        randomMovies.forEach((movie) => {
          const card = document.createElement("li");
          card.className = "movie-poster-box watchlist-card watchlist-card-preview";
          card.style.cursor = "pointer";

          const poster = movie.poster && movie.poster !== "N/A" ? movie.poster : "https://via.placeholder.com/300x450?text=No+Poster";

          card.innerHTML = `
            <img class="recon-poster" src="${poster}" alt="${movie.title}">
            <div class="watchlist-card-blur-overlay"></div>
          `;

          // Redirect to login page when clicked
          card.addEventListener("click", () => {
            window.location.href = "login.html";
          });

          watchlistGrid.appendChild(card);
        });

        // Add centered message overlay to the viewport container
        const viewportContainer = watchlistGrid.parentElement;
        const messageOverlay = document.createElement("div");
        messageOverlay.className = "watchlist-center-message";
        messageOverlay.style.cursor = "pointer";
        messageOverlay.innerHTML = `
          <h4>Sign in to start building your personalized watchlist</h4>
        `;
        
        // Redirect to login page when message is clicked
        messageOverlay.addEventListener("click", () => {
          window.location.href = "login.html";
        });
        
        viewportContainer.appendChild(messageOverlay);
        updateWatchlistSliderVisibility();
      });
      return;
    }

    if (!items.length) {
      watchlistEmpty.textContent = "No movies in your watchlist yet.";
      watchlistEmpty.classList.remove("hidden");
      updateWatchlistSliderVisibility();
      return;
    }

    watchlistEmpty.classList.add("hidden");

    items.forEach((movie) => {
      const card = document.createElement("li");
      card.className = "movie-poster-box watchlist-card";
      card.dataset.imdbId = movie.imdb_id || "";
      card.dataset.tmdbId = movie.tmdb_id || "";
      card.dataset.movieTitle = movie.title || "Untitled";
      card.dataset.movieYear = movie.year || "";
      card.dataset.movieType = movie.type || "movie";

      const poster = movie.poster && movie.poster !== "N/A" ? movie.poster : "https://via.placeholder.com/300x450?text=No+Poster";
      const safePoster = escapeHtml(poster);
      const safeTitle = escapeHtml(movie.title || "Untitled");
      const safeYear = escapeHtml(movie.year || "Unknown Year");
      const safeType = escapeHtml((movie.type || "movie").toUpperCase());
      const isLiked = isFavoriteMovie(movie.imdb_id);
      const watchIcon = escapeHtml(WATCHLIST_ACTION_ICONS.watch);
      const watchlistIcon = escapeHtml(WATCHLIST_ACTION_ICONS.watchlist);
      const favoriteIcon = escapeHtml(WATCHLIST_ACTION_ICONS.favorite);
      const removeIcon = escapeHtml(WATCHLIST_ACTION_ICONS.remove);

      card.innerHTML = `
        <img class="recon-poster" src="${safePoster}" alt="${safeTitle}">
        <div class="watchlist-card-overlay">
          <h3>${safeTitle}</h3>
          <p>${safeYear} • ${safeType}</p>
          <div class="profile-rail-actions">
            <button class="profile-rail-icon-btn" type="button" data-action="watch" aria-label="Play now" title="Play now">
              <img src="${watchIcon}" alt="" loading="lazy">
            </button>
            <button class="profile-rail-icon-btn" type="button" data-action="watchlist" aria-label="Add to watchlist" title="Add to watchlist" aria-pressed="true">
              <img src="${watchlistIcon}" alt="" loading="lazy">
            </button>
            <button class="profile-rail-icon-btn" type="button" data-action="favorite" aria-label="Add to favorite" title="Add to favorite" aria-pressed="${isLiked ? "true" : "false"}">
              <img src="${favoriteIcon}" alt="" loading="lazy">
            </button>
            <button class="profile-rail-icon-btn profile-rail-icon-btn-remove" type="button" data-action="remove" aria-label="Delete from list" title="Delete from list">
              <img src="${removeIcon}" alt="" loading="lazy">
            </button>
          </div>
        </div>
      `;

      watchlistGrid.appendChild(card);
    });

    if (watchlistGrid.dataset.actionsBound !== "true") {
      watchlistGrid.addEventListener("click", async (event) => {
        const actionBtn = event.target.closest("[data-action]");
        if (!actionBtn) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        await handleWatchlistGridAction(actionBtn);
      });

      watchlistGrid.dataset.actionsBound = "true";
    }

    updateWatchlistSliderVisibility();

    // Re-check after images settle to avoid false positives before posters load.
    window.setTimeout(updateWatchlistSliderVisibility, 200);
  }

  async function refreshWatchlist() {
    if (!watchlistGrid) {
      return;
    }

    setLoading(true);
    const items = await fetchWatchlist();
    setLoading(false);
    renderWatchlistItems(items);
    
    // Initialize slider for watchlist carousel
    if (window.initializeHorizontalSlider) {
      setTimeout(() => {
        window.initializeHorizontalSlider("#watchlist-grid", "watchlist-next-slide", "watchlist-prev-slide", {
          enableGestures: true
        });
        updateWatchlistSliderVisibility();
      }, 0);
    }
  }

  async function signInWithGoogle() {
    if (!supabaseClient) {
      return;
    }

    emitRealtimeAuthEvent("oauth:start", { provider: "google" });
    try {
      await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.SUPABASE_CONFIG.redirectTo
        }
      });
      emitRealtimeAuthEvent("oauth:redirect", { provider: "google" });
    } catch (error) {
      emitRealtimeAuthEvent("oauth:error", { provider: "google" });
      setAuthStatus("Google login failed. Please try again.");
    }
  }

  async function signInWithFacebook() {
    if (!supabaseClient) {
      return;
    }

    emitRealtimeAuthEvent("oauth:start", { provider: "facebook" });
    try {
      await supabaseClient.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: window.SUPABASE_CONFIG.redirectTo
        }
      });
      emitRealtimeAuthEvent("oauth:redirect", { provider: "facebook" });
    } catch (error) {
      emitRealtimeAuthEvent("oauth:error", { provider: "facebook" });
      setAuthStatus("Facebook login failed. Please try again.");
    }
  }

  async function signOut() {
    const signedOutUserId = currentUser && currentUser.id ? currentUser.id : "unknown";

    if (logoutBtn) {
      logoutBtn.disabled = true;
    }
    setAuthStatus("Signing out...");

    emitRealtimeAppEvent("auth:signout", {
      userId: signedOutUserId,
      phase: "start"
    });

    clearSupabaseAuthStorage();
    currentUser = null;
    updateProfileLinkDestination(false);
    updateProfileAvatar("");
    toggleAuthButtons(false);

    try {
      localStorage.setItem("fiscus:auth:signout", JSON.stringify({
        userId: signedOutUserId,
        at: new Date().toISOString()
      }));
    } catch (_) {
      // Ignore storage failures.
    }

    document.dispatchEvent(new CustomEvent("fiscus:auth-signed-out", {
      detail: { userId: signedOutUserId }
    }));

    emitRealtimeAppEvent("auth:signout", {
      userId: signedOutUserId,
      phase: "complete"
    });

    if (supabaseClient) {
      supabaseClient.auth.signOut({ scope: "local" }).catch((error) => {
        console.warn("Local sign out completed, but Supabase returned an error:", error);
      });
    }

    window.location.replace("/");
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
    emitRealtimeAppEvent("watchlist:add", {
      userId: currentUser.id,
      imdbId: movie.imdb_id,
      tmdbId: movie.tmdb_id || ""
    });
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
      updateProfileLinkDestination(true);
      if (profileLink) {
        profileLink.setAttribute("title", `Signed in as ${currentUser.email}`);
      }
      updateProfileAvatar(resolveUserAvatar(currentUser));
      toggleAuthButtons(true);
      try {
        await refreshProfileCollections();
      } catch (error) {
        console.error("Could not refresh Supabase profile collections:", error);
      }

      try {
        await refreshWatchlist();
      } catch (error) {
        console.error("Could not refresh watchlist:", error);
      }
    } else {
      favoritesCache = [];
      searchHistoryCache = [];
      setAuthStatus("Not signed in");
      updateProfileLinkDestination(false);
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
      setAuthStatus("Supabase is not configured for authentication.");
      updateProfileLinkDestination(false);
      updateProfileAvatar("");
      if (loginBtn) {
        loginBtn.disabled = true;
      }
      if (authSubmitBtn) {
        authSubmitBtn.disabled = true;
      }
      if (facebookBtn) {
        facebookBtn.disabled = true;
      }
      if (resendVerifyBtn) {
        resendVerifyBtn.disabled = true;
      }
      if (logoutBtn) {
        logoutBtn.classList.add("hidden");
      }
      if (watchlistEmpty) {
        watchlistEmpty.textContent = "Configure Supabase to use watchlist.";
      }
      finishAuthReady();
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

    if (resendVerifyBtn) {
      resendVerifyBtn.addEventListener("click", async () => {
        const emailToUse = pendingVerificationEmail || (authEmailInput ? authEmailInput.value.trim() : "");
        resendVerifyBtn.disabled = true;
        setAuthStatus("Sending verification email...");
        const resendResult = await resendVerificationEmail(emailToUse);
        resendVerifyBtn.disabled = false;
        setAuthStatus(resendResult.message);
      });
    }

    if (facebookBtn) {
      facebookBtn.addEventListener("click", async () => {
        await signInWithFacebook();
      });
    }

    if (hasEmailAuthForm()) {
      setAuthMode("signup");
      authForm.addEventListener("submit", handleEmailAuthSubmit);

      if (authModeToggle) {
        authModeToggle.addEventListener("click", (event) => {
          event.preventDefault();
          setAuthMode(authMode === "signup" ? "signin" : "signup");
          setAuthStatus("");
        });
      }
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        signOut();
      });
    }

    try {
      await updateSessionState();
    } catch (error) {
      console.error("Auth session setup failed:", error);
      setAuthStatus("Signed in, but profile data could not load.");
    }

    window.addEventListener("resize", updateWatchlistSliderVisibility);

    supabaseClient.auth.onAuthStateChange(async () => {
      await updateSessionState();
    });

    if (window.FiscusRealtime && typeof window.FiscusRealtime.onAppEvent === "function") {
      window.FiscusRealtime.onAppEvent(async (payload) => {
        if (!payload || !payload.type) {
          return;
        }

        const details = payload.details || {};
        const sameUser = currentUser && details.userId && currentUser.id === details.userId;

        if (payload.type === "watchlist:add" && sameUser) {
          await refreshWatchlist();
          return;
        }

        if (payload.type === "favorite:toggle" && sameUser) {
          await loadFavoritesFromSupabase();
          setAuthStatus(details.liked ? "Favorite added in another tab." : "Favorite removed in another tab.");
          return;
        }

        if (payload.type === "auth:signout" && sameUser) {
          await updateSessionState();
          if (!window.location.pathname.endsWith("/") && !window.location.pathname.endsWith("index.html")) {
            window.location.replace("/");
          }
        }
      });
    }

    window.addEventListener("storage", async (event) => {
      if (event.key !== "fiscus:auth:signout" || !event.newValue) {
        return;
      }

      await updateSessionState();
      if (!window.location.pathname.endsWith("/") && !window.location.pathname.endsWith("index.html")) {
        window.location.replace("/");
      }
    });

    finishAuthReady();
  }

  window.FiscusAuth = {
    addMovieToWatchlist,
    refreshWatchlist,
    signInWithGoogle,
    signOut,
    getFavorites,
    getSearchHistory,
    refreshProfileCollections,
    isFavoriteMovie,
    toggleFavoriteMovie,
    removeFavoriteMovie,
    addSearchHistory,
    removeSearchHistoryItem,
    isAuthenticated,
    getSupabaseClient,
    getCurrentUser,
    ready: waitUntilReady
  };

  document.addEventListener("DOMContentLoaded", init);
})();
