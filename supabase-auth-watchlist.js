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
  const watchlistEmpty = document.getElementById("watchlist-empty");
  const watchlistLoading = document.getElementById("watchlist-loading");
  const SEARCH_HISTORY_LIMIT = 30;
  const WATCHLIST_ACTION_ICONS = {
    watch: "play-512.png",
    watchlist: "plus-2-512.png",
    favorite: "favorite-2-512.png",
    remove: "trash-2-512.png"
  };

  let supabaseClient = null;
  let currentUser = null;
  let authMode = "signup";
  let pendingVerificationEmail = "";

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
      return;
    }

    if (authSubmitBtn) {
      authSubmitBtn.disabled = true;
    }

    if (authMode === "signin") {
      setAuthStatus("Signing in...");
      const result = await signInWithEmailPassword(email, password);
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
      }

      if (!result.ok) {
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
      return;
    }

    if (authTermsCheckbox && !authTermsCheckbox.checked) {
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
      }
      setAuthStatus("You must accept the terms to create an account.");
      return;
    }

    setAuthStatus("Creating account...");
    const result = await signUpWithEmailPassword({ firstName, lastName, email, password });

    if (authSubmitBtn) {
      authSubmitBtn.disabled = false;
    }

    if (!result.ok) {
      setAuthStatus(result.message);
      return;
    }

    if (result.needsEmailConfirm) {
      setAuthStatus("Account created. Check your email to confirm your account, then sign in.");
      pendingVerificationEmail = email;
      showResendVerificationButton(true);
      setAuthMode("signin");
      return;
    }

    setAuthStatus("Account created. Redirecting to profile...");
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
      poster: entry.poster || entry.poster_path || "",
      media_type: entry.media_type || "movie",
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

      const result = toggleFavoriteMovie(payload);
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
      let apiKey = null;
      if (window.TMDB_CONFIG && window.TMDB_CONFIG.apiKey && !window.TMDB_CONFIG.apiKey.includes("YOUR_TMDB_API_KEY")) {
        apiKey = window.TMDB_CONFIG.apiKey;
      }
      
      if (!apiKey) {
        console.warn("TMDB API key not found for random movies preview");
        return [];
      }

      const randomPage = Math.floor(Math.random() * 50) + 1;
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=${randomPage}`
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
      });
      return;
    }

    if (!items.length) {
      watchlistEmpty.textContent = "No movies in your watchlist yet.";
      watchlistEmpty.classList.remove("hidden");
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
          enableGestures: false
        });
      }, 0);
    }
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

  async function signInWithFacebook() {
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signInWithOAuth({
      provider: "facebook",
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
    window.location.href = "index.html";
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
      updateProfileLinkDestination(true);
      if (profileLink) {
        profileLink.setAttribute("title", `Signed in as ${currentUser.email}`);
      }
      updateProfileAvatar(resolveUserAvatar(currentUser));
      toggleAuthButtons(true);
      await refreshWatchlist();
    } else {
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
    addSearchHistory,
    isAuthenticated
  };

  document.addEventListener("DOMContentLoaded", init);
})();
