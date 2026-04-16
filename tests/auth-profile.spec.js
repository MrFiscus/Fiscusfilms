const { test, expect } = require("@playwright/test");

const MOCK_SUPABASE_SCRIPT = `
(function () {
  function readSession() {
    const raw = window.localStorage.getItem("mock:supabase-session");
    return raw ? JSON.parse(raw) : null;
  }

  function writeSession(user) {
    const session = user ? { user, access_token: "mock-token" } : null;
    if (session) {
      window.localStorage.setItem("mock:supabase-session", JSON.stringify(session));
    } else {
      window.localStorage.removeItem("mock:supabase-session");
    }
    return session;
  }

  function notify(event, session) {
    (window.__mockAuthListeners || []).forEach((callback) => callback(event, session));
  }

  function makeUser(email) {
    return {
      id: "user-123",
      email,
      created_at: "2026-01-01T00:00:00.000Z",
      user_metadata: {
        first_name: "Test",
        last_name: "User",
        display_name: "Test User",
        full_name: "Test User"
      }
    };
  }

  function makeQuery(data) {
    const query = {
      select: function () { return query; },
      eq: function () { return query; },
      order: function () { return Promise.resolve({ data: data || [], error: null }); },
      upsert: function () { return Promise.resolve({ data: null, error: null }); },
      delete: function () { return query; }
    };
    return query;
  }

  window.__mockAuthListeners = window.__mockAuthListeners || [];
  window.supabase = {
    createClient: function () {
      return {
        auth: {
          getSession: async function () {
            return { data: { session: readSession() }, error: null };
          },
          signInWithPassword: async function (credentials) {
            const user = makeUser(credentials.email);
            const session = writeSession(user);
            notify("SIGNED_IN", session);
            return { data: { user, session }, error: null };
          },
          signUp: async function (credentials) {
            const user = makeUser(credentials.email);
            const session = writeSession(user);
            notify("SIGNED_IN", session);
            return { data: { user, session }, error: null };
          },
          signOut: async function () {
            writeSession(null);
            notify("SIGNED_OUT", null);
            return { error: null };
          },
          signInWithOAuth: async function () {
            return { data: {}, error: null };
          },
          resend: async function () {
            return { data: {}, error: null };
          },
          updateUser: async function (updates) {
            const session = readSession();
            if (!session) {
              return { data: { user: null }, error: { message: "Auth session missing" } };
            }
            session.user.user_metadata = { ...session.user.user_metadata, ...(updates.data || {}) };
            if (updates.email) {
              session.user.email = updates.email;
            }
            writeSession(session.user);
            notify("USER_UPDATED", session);
            return { data: { user: session.user }, error: null };
          },
          onAuthStateChange: function (callback) {
            window.__mockAuthListeners.push(callback);
            return {
              data: {
                subscription: {
                  unsubscribe: function () {}
                }
              }
            };
          }
        },
        from: function () {
          return makeQuery([]);
        }
      };
    }
  };
})();
`;

test.beforeEach(async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: MOCK_SUPABASE_SCRIPT
    });
  });
});

test("email login shows the signed-in profile and logout clears the session", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("link", { name: "Log in" }).click();
  await page.locator("#auth-email").fill("test@example.com");
  await page.locator("#auth-password").fill("password123");
  await page.locator("#auth-submit-btn").click();

  await expect(page).toHaveURL(/\/profile\.html$/);
  await page.evaluate(() => {
    window.localStorage.setItem("sb-eotvmsheeitniegagrby-auth-token", JSON.stringify({ currentSession: "stale" }));
  });
  await expect(page.locator("#profile-auth-status")).toContainText("Signed in as test@example.com");
  await expect(page.locator("#profile-form")).toBeVisible();
  await expect(page.locator("#profile-logout-btn")).toBeVisible();
  await expect(page.locator("#profile-login-btn")).toHaveClass(/hidden/);

  await page.locator("#profile-logout-btn").click();

  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("sb-eotvmsheeitniegagrby-auth-token"))).toBeNull();
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("mock:supabase-session"))).toBeNull();
  await expect(page.locator("body")).toHaveClass(/home-view/);
  await expect(page.locator("#profile-link")).toHaveAttribute("href", "login.html");
});

test("profile page stays in guest mode when no user is signed in", async ({ page }) => {
  await page.goto("/profile");

  await expect(page.locator("#profile-auth-status")).toContainText("Sign in to view your profile insights.");
  await expect(page.locator("#profile-form")).toHaveClass(/hidden/);
  await expect(page.locator("#profile-login-btn")).toBeVisible();
  await expect(page.locator("#profile-logout-btn")).toHaveClass(/hidden/);
});

test("movie details prefer clicked TMDB id over stale stored IMDb id", async ({ page }) => {
  await page.route("**/api/tmdb/movie/238?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 238,
        title: "The Godfather",
        release_date: "1972-03-14",
        runtime: 175,
        vote_average: 8.7,
        overview: "The aging patriarch of an organized crime dynasty transfers control to his reluctant son.",
        poster_path: null,
        backdrop_path: null,
        genres: [{ name: "Drama" }],
        credits: { cast: [] },
        external_ids: { imdb_id: "tt0068646" },
        "watch/providers": { results: {} },
        videos: { results: [] },
        recommendations: { results: [] },
        images: { logos: [] }
      })
    });
  });

  await page.route("**/api/tmdb/find/tt0111161?**", async (route) => {
    throw new Error(`Stale IMDb id should not be requested: ${route.request().url()}`);
  });

  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("movieID", "tt0111161");
    window.localStorage.setItem("selectedMovieID", "tt0111161");
    window.localStorage.setItem("tmdbMovieID", "238");
    window.localStorage.setItem("tmdbMediaType", "movie");
  });

  await page.goto("/movies.html?tmdb=238&type=movie");

  await expect(page.locator(".movie-title")).toContainText("The Godfather");
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("movieID"))).toBeNull();
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("selectedMovieID"))).toBeNull();
});

test("home hero does not flash stale fallback movie while loading", async ({ page }) => {
  await page.route("**/api/tmdb/trending/movie/week", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false })
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#app-loading-screen")).toBeVisible();
  await expect(page.locator(".body-main")).toContainText("Loading featured movies...");
  await expect(page.locator(".body-main")).not.toContainText("500 Days of Summer");
});

test("profile loading screen clears after profile state resolves", async ({ page }) => {
  await page.goto("/profile");

  await expect(page.locator("#app-loading-screen")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/loading-view/);
  await expect(page.locator("#profile-auth-status")).toContainText("Sign in to view your profile insights.");
});
