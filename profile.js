(function () {
  const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='31' fill='%231b263b'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23ebebea'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23ebebea'/%3E%3C/svg%3E";

  const formEl = document.getElementById("profile-form");
  const nameHeading = document.getElementById("profile-name-heading");
  const memberSinceEl = document.getElementById("profile-member-since");
  const statusIndicator = document.getElementById("profile-status-indicator");
  const overviewFavoritesCountEl = document.getElementById("overview-favorites-count");
  const overviewWatchlistCountEl = document.getElementById("overview-watchlist-count");
  const overviewHistoryCountEl = document.getElementById("overview-history-count");
  const favoritesListEl = document.getElementById("profile-favorites-list");
  const watchlistListEl = document.getElementById("profile-watchlist-list");
  const historyListEl = document.getElementById("profile-history-list");
  const displayNameInput = document.getElementById("profile-display-name");
  const emailInput = document.getElementById("profile-email");
  const avatarPreview = document.getElementById("profile-avatar-preview");
  const formAvatarPreview = document.getElementById("profile-form-avatar-preview");
  const saveMessage = document.getElementById("profile-save-message");
  const saveBtn = document.getElementById("profile-save-btn");
  const statusEl = document.getElementById("auth-status");

  let supabaseClient = null;
  let currentUser = null;

  function setStatus(message) {
    if (!statusEl) {
      return;
    }

    statusEl.textContent = message;
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

  function updateStatusIndicator(loggedIn) {
    if (!statusIndicator) {
      return;
    }

    statusIndicator.textContent = loggedIn ? "Active" : "Offline";
    statusIndicator.classList.toggle("profile-status-online", loggedIn);
    statusIndicator.classList.toggle("profile-status-offline", !loggedIn);
  }

  function updateCollectionSummary(watchlistItems, favoriteItems, historyItems) {
    if (overviewFavoritesCountEl) {
      overviewFavoritesCountEl.textContent = String(favoriteItems.length);
    }
    if (overviewHistoryCountEl) {
      overviewHistoryCountEl.textContent = String(historyItems.length);
    }
    if (overviewWatchlistCountEl) {
      overviewWatchlistCountEl.textContent = String(watchlistItems.length);
    }

    if (favoritesListEl) {
      if (!favoriteItems.length) {
        favoritesListEl.innerHTML = "<li>No movies yet</li>";
      } else {
        favoritesListEl.innerHTML = favoriteItems
          .slice(0, 4)
          .map((item) => `<li>${item.title}${item.year ? ` (${item.year})` : ""}</li>`)
          .join("");
      }
    }
    if (historyListEl) {
      if (!historyItems.length) {
        historyListEl.innerHTML = "<li>No movies yet</li>";
      } else {
        historyListEl.innerHTML = historyItems
          .slice(0, 4)
          .map((item) => `<li>${item.title}${item.year ? ` (${item.year})` : ""}</li>`)
          .join("");
      }
    }

    if (watchlistListEl) {
      if (!watchlistItems.length) {
        watchlistListEl.innerHTML = "<li>No movies yet</li>";
      } else {
        const topItems = watchlistItems.slice(0, 4);
        watchlistListEl.innerHTML = topItems
          .map((item) => `<li>${item.title}${item.year ? ` (${item.year})` : ""}</li>`)
          .join("");
      }
    }
  }

  async function loadWatchlistSummary() {
    if (!supabaseClient || !currentUser) {
      const favorites = window.FiscusAuth && window.FiscusAuth.getFavorites
        ? window.FiscusAuth.getFavorites()
        : [];
      const history = window.FiscusAuth && window.FiscusAuth.getSearchHistory
        ? window.FiscusAuth.getSearchHistory()
        : [];
      updateCollectionSummary([], favorites, history);
      return;
    }

    const { data, error } = await supabaseClient
      .from("watchlist")
      .select("title, year, added_at")
      .eq("user_id", currentUser.id)
      .order("added_at", { ascending: false });

    if (error) {
      const favorites = window.FiscusAuth && window.FiscusAuth.getFavorites
        ? window.FiscusAuth.getFavorites()
        : [];
      const history = window.FiscusAuth && window.FiscusAuth.getSearchHistory
        ? window.FiscusAuth.getSearchHistory()
        : [];
      updateCollectionSummary([], favorites, history);
      return;
    }

    const favorites = window.FiscusAuth && window.FiscusAuth.getFavorites
      ? window.FiscusAuth.getFavorites()
      : [];
    const history = window.FiscusAuth && window.FiscusAuth.getSearchHistory
      ? window.FiscusAuth.getSearchHistory()
      : [];

    updateCollectionSummary(data || [], favorites, history);
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
    if (formAvatarPreview) {
      formAvatarPreview.src = resolvedAvatar;
    }
  }

  async function loadSession() {
    if (!supabaseClient) {
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setStatus("Could not load session.");
      setSaveMessage(error.message, true);
      return;
    }

    currentUser = data && data.session ? data.session.user : null;

    if (!currentUser) {
      setStatus("Sign in to edit your profile.");
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
      if (formAvatarPreview) {
        formAvatarPreview.src = FALLBACK_AVATAR;
      }
      updateStatusIndicator(false);
      updateCollectionSummary([], [], []);
      return;
    }

    setStatus(`Signed in as ${currentUser.email}`);
    if (formEl) {
      formEl.classList.remove("hidden");
    }

    hydrateFormFromUser(currentUser);
    updateStatusIndicator(true);
    await loadWatchlistSummary();
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

    if (!isConfigured()) {
      setStatus("Configure Supabase to enable profile settings.");
      setSaveMessage("Supabase is not configured.", true);
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
