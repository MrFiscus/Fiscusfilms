# FiscusFilms

FiscusFilms is a movie discovery and watchlist web app built with static frontend pages and a small Node.js/Express backend. The backend serves the app, proxies TMDB requests so API keys stay out of the browser, and powers realtime auth/watchlist events with Socket.IO.

## Features

- Browse trending, popular, top-rated, upcoming, and currently airing titles
- Search movies and TV shows through TMDB
- View movie details, cast, providers, videos, recommendations, and posters
- Create an account and sign in with Supabase Auth
- Save watchlist, favorites, search history, profile details, avatar, and backdrop preferences
- Realtime updates for auth, watchlist, favorites, sign-out, and profile backdrop events

## Tech Stack

- Frontend: HTML, CSS, and vanilla JavaScript in `public/`
- Backend: Node.js, Express, and Socket.IO
- Auth/storage: Supabase
- Movie data: TMDB API through the Express proxy

## Project Structure

```text
FiscusFilms/
  public/
    index.html
    login.html
    movies.html
    profile.html
    css/
      style.css
    js/
      script.js
      profile.js
      moviepagescript.js
      navbar.js
      realtime-client.js
      supabase-auth-watchlist.js
      supabase-config.js
      tmdb-config.js
    assets/
      *.png
      posters/
        *.jpg
        *.avif
  server.js
  package.json
  package-lock.json
  .env.example
  .gitignore
```

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   # PowerShell
   Copy-Item .env.example .env

   # macOS/Linux
   cp .env.example .env
   ```

3. Add your TMDB credentials to `.env`:

   ```env
   PORT=3000
   TMDB_API_KEY=your_tmdb_api_key_here
   TMDB_READ_ACCESS_TOKEN=your_tmdb_read_access_token_here
   ```

4. Run the app in development:

   ```bash
   npm run dev
   ```

5. Open the app:

   ```text
   http://localhost:3000
   ```

## Scripts

- `npm run dev`: Start the server with `nodemon`
- `npm start`: Start the server with Node
- `npm run test:e2e`: Run Playwright browser tests for login, logout, and profile state

## App Routes

- `/`: Home page
- `/login`: Login and signup page
- `/profile`: User profile page
- `/movies`: Movie/TV details page

## API Routes

- `GET /api/health`: Health check for the backend
- `GET /api/realtime/auth-state`: Current realtime app state
- `GET /api/realtime/app-state`: Alias for realtime app state
- `GET /api/tmdb/*`: TMDB proxy route

TMDB proxy examples:

```text
/api/tmdb/search/multi?query=inception&include_adult=false&page=1
/api/tmdb/movie/550?append_to_response=images,credits
/api/tmdb/tv/1399/external_ids
```

## Environment Variables

Create `.env` from `.env.example`. Do not commit `.env`.

| Name | Required | Description |
| --- | --- | --- |
| `PORT` | No | Local server port. Defaults to `3000`. |
| `TMDB_API_KEY` | Yes | TMDB API key used by the backend proxy. |
| `TMDB_READ_ACCESS_TOKEN` | No | Optional TMDB v4 read access token. Keep it in `.env` or your host's environment variables if you use TMDB endpoints that require bearer auth. |

## Notes Before Pushing

- Keep secrets in `.env`; `.gitignore` is set up to avoid committing local env files.
- Public frontend files belong in `public/`.
- Browser JavaScript belongs in `public/js/`.
- Styles belong in `public/css/`.
- Images and icons belong in `public/assets/`.
