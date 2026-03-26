const nav = document.getElementById('navbar');
window.addEventListener('scroll', () =>{

    if(window.scrollY > 40){
        nav.classList.add('nav-colored');
    } else if (window.scrollY <=40){
        nav.classList.remove('nav-colored');
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initializeHorizontalSlider(".trending-list", "trending-next-slide", "trending-prev-slide");
    initializeHorizontalSlider(".popular-list", "recom-next-slide", "recom-prev-slide");
    initializeHorizontalSlider(".upcoming-list", "upcoming-next-slide", "upcoming-prev-slide");
    initializeHorizontalSlider(".toprated-movies-list", "toprated-movies-next-slide", "toprated-movies-prev-slide");
    initializeHorizontalSlider(".trending-tv-list", "series-next-slide", "series-prev-slide");
    initializeHorizontalSlider(".popular-tv-list", "popular-tv-next-slide", "popular-tv-prev-slide");
    initializeHorizontalSlider(".toprated-tv-list", "toprated-tv-next-slide", "toprated-tv-prev-slide");
    initializeHorizontalSlider(".airing-tv-list", "airing-tv-next-slide", "airing-tv-prev-slide");
    initializeHorizontalSlider(".fiscus-list", "fiscus-next-slide", "fiscus-prev-slide");
    loadHomeMovieRails();
});

function initializeHorizontalSlider(listSelector, nextButtonId, prevButtonId, options = {}) {
    const movieList = document.querySelector(listSelector);
    const nextSlide = document.getElementById(nextButtonId);
    const prevSlide = document.getElementById(prevButtonId);
    const sliderViewport = movieList ? movieList.parentElement : null;

    if (!movieList || !nextSlide || !prevSlide || !sliderViewport) {
        return;
    }

    let currentStep = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastGestureAt = 0;

    const SWIPE_THRESHOLD = 35;
    const GESTURE_COOLDOWN_MS = 180;
    const enableGestures = options.enableGestures !== false;

    function getSliderMetrics() {
        const firstItem = movieList.querySelector(".movie-poster-box");
        if (!firstItem) {
            return null;
        }

        const firstItemStyle = window.getComputedStyle(firstItem);
        const listStyle = window.getComputedStyle(movieList);
        const marginRight = parseFloat(firstItemStyle.marginRight || "0");
        const listGap = parseFloat(listStyle.columnGap || listStyle.gap || "0");
        const stepWidth = firstItem.getBoundingClientRect().width + Math.max(marginRight, listGap);
        if (!stepWidth) {
            return null;
        }

        const containerWidth = movieList.parentElement ? movieList.parentElement.clientWidth : 0;
        const visibleSlides = Math.max(1, Math.floor(containerWidth / stepWidth));
        const maxStep = Math.max(0, movieList.children.length - visibleSlides);

        return { stepWidth, maxStep };
    }

    function applyTransform() {
        const metrics = getSliderMetrics();
        if (!metrics) {
            return;
        }

        if (currentStep > metrics.maxStep) {
            currentStep = metrics.maxStep;
        }

        movieList.style.transform = `translateX(${-currentStep * metrics.stepWidth}px)`;
    }

    function goNext() {
        const metrics = getSliderMetrics();
        if (!metrics || metrics.maxStep === 0) {
            return;
        }

        currentStep = currentStep >= metrics.maxStep ? 0 : currentStep + 1;
        applyTransform();
    }

    function goPrev() {
        const metrics = getSliderMetrics();
        if (!metrics || metrics.maxStep === 0) {
            return;
        }

        currentStep = currentStep <= 0 ? metrics.maxStep : currentStep - 1;
        applyTransform();
    }

    function canHandleGesture() {
        const now = Date.now();
        if (now - lastGestureAt < GESTURE_COOLDOWN_MS) {
            return false;
        }

        lastGestureAt = now;
        return true;
    }

    nextSlide.addEventListener("click", () => {
        goNext();
    });

    prevSlide.addEventListener("click", () => {
        goPrev();
    });

    if (enableGestures) {
        sliderViewport.addEventListener("touchstart", (event) => {
            if (!event.touches || !event.touches.length) {
                return;
            }

            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        }, { passive: true });

        sliderViewport.addEventListener("touchend", (event) => {
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
                goNext();
            } else {
                goPrev();
            }
        }, { passive: true });

        sliderViewport.addEventListener("wheel", (event) => {
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
                goNext();
            } else {
                goPrev();
            }
        }, { passive: false });
    }

    window.addEventListener("resize", applyTransform);
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const HOME_ACTION_ICONS = {
    watch: "play-512.png",
    watchlist: "plus-2-512.png",
    favorite: "favorite-2-512.png"
};
const imdbCache = new Map();

function getTmdbApiKey() {
    if (!window.TMDB_CONFIG || !window.TMDB_CONFIG.apiKey) {
        return null;
    }

    if (window.TMDB_CONFIG.apiKey.includes("YOUR_TMDB_API_KEY")) {
        return null;
    }

    return window.TMDB_CONFIG.apiKey;
}

async function loadHomeMovieRails() {
    const tmdbApiKey = getTmdbApiKey();
    renderRailMessage("trendingmovies", "Loading Trending Today...");
    renderRailMessage("nowplayingmovies", "Loading Now Playing...");
    renderRailMessage("upcomingmovies", "Loading Upcoming Movies...");
    renderRailMessage("topratedmovies", "Loading Top Rated Movies...");
    renderRailMessage("popularseries", "Loading Trending TV Shows...");
    renderRailMessage("populartv", "Loading Popular TV Shows...");
    renderRailMessage("topratedtv", "Loading Top Rated TV Shows...");
    renderRailMessage("airingtv", "Loading Currently Airing...");

    if (!tmdbApiKey) {
        console.warn("TMDb key missing. Add it to tmdb-config.js to load content.");
        renderRailMessage("trendingmovies", "Add TMDb API key in tmdb-config.js");
        renderRailMessage("nowplayingmovies", "Add TMDb API key in tmdb-config.js");
        renderRailMessage("upcomingmovies", "Add TMDb API key in tmdb-config.js");
        renderRailMessage("topratedmovies", "Add TMDb API key in tmdb-config.js");
        renderRailMessage("popularseries", "Add TMDb API key in tmdb-config.js");
        renderRailMessage("populartv", "Add TMDb API key in tmdb-config.js");
        renderRailMessage("topratedtv", "Add TMDb API key in tmdb-config.js");
        renderRailMessage("airingtv", "Add TMDb API key in tmdb-config.js");
        return;
    }

    await Promise.all([
        loadTmdbRail("/trending/movie/day", "trendingmovies", tmdbApiKey),
        loadTmdbRail("/movie/now_playing", "nowplayingmovies", tmdbApiKey),
        loadTmdbRail("/movie/upcoming", "upcomingmovies", tmdbApiKey),
        loadTmdbRail("/movie/top_rated", "topratedmovies", tmdbApiKey),
        loadTmdbRail("/trending/tv/day", "popularseries", tmdbApiKey),
        loadTmdbRail("/tv/popular", "populartv", tmdbApiKey),
        loadTmdbRail("/tv/top_rated", "topratedtv", tmdbApiKey),
        loadTmdbRail("/tv/on_the_air", "airingtv", tmdbApiKey)
    ]);
}

async function loadTmdbRail(endpoint, listElementId, apiKey) {
    const movieList = document.getElementById(listElementId);
    if (!movieList) {
        return;
    }

    try {
        const response = await fetch(`${TMDB_BASE_URL}${endpoint}?api_key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.success === false) {
            throw new Error(data.status_message || "TMDb returned an error");
        }

        const movies = (data.results || []).slice(0, 20);
        if (!movies.length) {
            renderRailMessage(listElementId, "No movies returned by TMDb");
            return;
        }

        renderTmdbMovieList(movieList, movies);
    } catch (error) {
        console.error(`Failed to load ${listElementId}:`, error);
        renderRailMessage(listElementId, `Could not load TMDb movies (${error.message})`);
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function openHomeRailMovie(cardEl) {
    if (!cardEl) {
        return;
    }

    const tmdbId = cardEl.dataset.tmdbId;
    const mediaType = cardEl.dataset.mediaType || "movie";
    if (!tmdbId) {
        return;
    }

    if (window.FiscusAuth && window.FiscusAuth.addSearchHistory) {
        window.FiscusAuth.addSearchHistory({
            tmdb_id: tmdbId,
            media_type: mediaType,
            title: cardEl.dataset.movieTitle || "Unknown",
            year: cardEl.dataset.movieYear || "N/A",
            poster: cardEl.dataset.moviePoster || ""
        });
    }

    localStorage.setItem("tmdbMovieID", tmdbId);
    localStorage.setItem("tmdbMediaType", mediaType);
    localStorage.removeItem("movieID");
    window.location.href = "movies.html";
}

async function resolveImdbId(tmdbId, mediaType) {
    if (!tmdbId) {
        return "";
    }

    const cacheKey = `${mediaType || "movie"}:${tmdbId}`;
    if (imdbCache.has(cacheKey)) {
        return imdbCache.get(cacheKey);
    }

    const apiKey = getTmdbApiKey();
    if (!apiKey) {
        return "";
    }

    try {
        if (mediaType === "tv") {
            const tvResponse = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/external_ids?api_key=${apiKey}`);
            if (!tvResponse.ok) {
                imdbCache.set(cacheKey, "");
                return "";
            }

            const tvData = await tvResponse.json();
            const tvImdb = tvData && tvData.imdb_id ? String(tvData.imdb_id) : "";
            imdbCache.set(cacheKey, tvImdb);
            return tvImdb;
        }

        const movieResponse = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${apiKey}`);
        if (!movieResponse.ok) {
            imdbCache.set(cacheKey, "");
            return "";
        }

        const movieData = await movieResponse.json();
        const movieImdb = movieData && movieData.imdb_id ? String(movieData.imdb_id) : "";
        imdbCache.set(cacheKey, movieImdb);
        return movieImdb;
    } catch (error) {
        imdbCache.set(cacheKey, "");
        return "";
    }
}

async function handleHomeRailAction(cardEl, action) {
    if (!cardEl || !action) {
        return;
    }

    if ((action === "watchlist" || action === "favorite")) {
        const isLoggedIn = Boolean(
            window.FiscusAuth
            && typeof window.FiscusAuth.isAuthenticated === "function"
            && window.FiscusAuth.isAuthenticated()
        );

        if (!isLoggedIn) {
            window.location.href = "login.html";
            return;
        }
    }

    if (action === "watch") {
        openHomeRailMovie(cardEl);
        return;
    }

    const tmdbId = cardEl.dataset.tmdbId || "";
    const mediaType = cardEl.dataset.mediaType || "movie";
    const imdbId = cardEl.dataset.imdbId || await resolveImdbId(tmdbId, mediaType);
    if (!imdbId) {
        return;
    }

    cardEl.dataset.imdbId = imdbId;

    const moviePayload = {
        imdb_id: imdbId,
        tmdb_id: tmdbId,
        title: cardEl.dataset.movieTitle || "Untitled",
        year: cardEl.dataset.movieYear || "",
        poster: cardEl.dataset.moviePoster || "",
        type: mediaType
    };

    if (action === "watchlist" && window.FiscusAuth && window.FiscusAuth.addMovieToWatchlist) {
        const result = await window.FiscusAuth.addMovieToWatchlist(moviePayload);
        if (result && result.ok) {
            const btn = cardEl.querySelector('[data-action="watchlist"]');
            if (btn) {
                btn.setAttribute("aria-pressed", "true");
            }
        }
        return;
    }

    if (action === "favorite" && window.FiscusAuth && window.FiscusAuth.toggleFavoriteMovie) {
        const result = window.FiscusAuth.toggleFavoriteMovie(moviePayload);
        const btn = cardEl.querySelector('[data-action="favorite"]');
        if (btn && result && result.ok) {
            btn.setAttribute("aria-pressed", result.liked ? "true" : "false");
        }
    }
}

function renderTmdbMovieList(movieList, movies) {
    movieList.innerHTML = "";

    movies.forEach((movie) => {
        const mediaTitle = movie.title || movie.name || "Untitled";
        const mediaDate = movie.release_date || movie.first_air_date || "";
        const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
        const posterPath = movie.poster_path
            ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
            : "https://via.placeholder.com/300x450?text=No+Poster";
        const year = mediaDate ? mediaDate.split("-")[0] : "N/A";
        const safeTitle = escapeHtml(mediaTitle);
        const safeYear = escapeHtml(year);
        const safePoster = escapeHtml(posterPath);
        const safeType = escapeHtml(mediaType);
        const safeTmdbId = escapeHtml(movie.id);
        const safePlayIcon = escapeHtml(HOME_ACTION_ICONS.watch);
        const safeWatchlistIcon = escapeHtml(HOME_ACTION_ICONS.watchlist);
        const safeFavoriteIcon = escapeHtml(HOME_ACTION_ICONS.favorite);

        const listItem = document.createElement("li");
        listItem.className = "movie-poster-box home-rail-card";
        listItem.dataset.tmdbId = String(movie.id);
        listItem.dataset.mediaType = mediaType;
        listItem.dataset.movieTitle = mediaTitle;
        listItem.dataset.movieYear = year;
        listItem.dataset.moviePoster = posterPath;
        listItem.innerHTML = `
            <img class="recon-poster" src="${safePoster}" alt="${safeTitle}">
            <div class="home-rail-overlay">
                <h3>${safeTitle}${safeYear ? ` (${safeYear})` : ""}</h3>
                <p>${safeType.toUpperCase()}</p>
                <div class="home-rail-actions">
                    <button class="home-rail-icon-btn" type="button" data-action="watch" aria-label="Play now" title="Play now">
                        <img src="${safePlayIcon}" alt="" loading="lazy">
                    </button>
                    <button class="home-rail-icon-btn" type="button" data-action="watchlist" aria-label="Add to watchlist" title="Add to watchlist" aria-pressed="false">
                        <img src="${safeWatchlistIcon}" alt="" loading="lazy">
                    </button>
                    <button class="home-rail-icon-btn" type="button" data-action="favorite" aria-label="Add to favorite" title="Add to favorite" aria-pressed="false">
                        <img src="${safeFavoriteIcon}" alt="" loading="lazy">
                    </button>
                </div>
            </div>
        `;

        movieList.appendChild(listItem);
    });

    if (movieList.dataset.actionsBound !== "true") {
        movieList.addEventListener("click", async (event) => {
            const actionBtn = event.target.closest("[data-action]");
            if (actionBtn) {
                event.preventDefault();
                event.stopPropagation();

                const cardEl = actionBtn.closest(".home-rail-card");
                if (!cardEl) {
                    return;
                }

                const action = actionBtn.dataset.action;
                await handleHomeRailAction(cardEl, action);
                return;
            }

            const cardEl = event.target.closest(".home-rail-card");
            if (!cardEl) {
                return;
            }
            openHomeRailMovie(cardEl);
        });

        movieList.dataset.actionsBound = "true";
    }
}

function renderRailMessage(listElementId, message) {
    const movieList = document.getElementById(listElementId);
    if (!movieList) {
        return;
    }

    movieList.innerHTML = `
        <li class="movie-poster-box">
            <div class="recon-poster" style="display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(255,255,255,0.08);text-align:center;padding:12px;line-height:1.3;">
                ${message}
            </div>
        </li>
    `;
}

async function fetchTrendingMoviesForHomepage() {
    const apiKey = getTmdbApiKey();
    if (!apiKey) {
        console.warn("TMDb API key not configured. Using fallback content.");
        return null;
    }

    try {
        const response = await fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const movies = (data.results || []).slice(0, 10);
        
        if (!movies.length) {
            return null;
        }

        // Fetch full details with images for each movie to get logos
        const contentArray = await Promise.all(movies.map(async (movie) => {
            let logoUrl = "";
            try {
                const detailsResponse = await fetch(`${TMDB_BASE_URL}/movie/${movie.id}?api_key=${apiKey}&append_to_response=images`);
                if (detailsResponse.ok) {
                    const details = await detailsResponse.json();
                    const logos = details.images && Array.isArray(details.images.logos) ? details.images.logos : [];
                    const preferredLogo = logos.find((logo) => logo.iso_639_1 === 'en')
                        || logos.find((logo) => logo.iso_639_1 === null)
                        || logos[0];
                    if (preferredLogo && preferredLogo.file_path) {
                        logoUrl = `https://image.tmdb.org/t/p/original${preferredLogo.file_path}`;
                    }
                }
            } catch (logoError) {
                console.warn(`Failed to fetch logo for movie ${movie.id}:`, logoError);
            }

            return {
                tmdbId: movie.id,
                title: movie.title || "Untitled",
                rating: movie.vote_average ? (movie.vote_average.toFixed(1)) + "/10" : "N/A",
                description: movie.overview || "No description available.",
                backdropPath: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : "",
                logoUrl: logoUrl
            };
        }));

        return contentArray;
    } catch (error) {
        console.error("Failed to fetch trending movies:", error);
        return null;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    let currentSlide = 1;
    let totalSlides = 10;
    const intervalTime = 10000;

    const bodyPoster = document.querySelector('.body-poster');
    const bodyMainDiv = document.querySelector('.body-main');
    const prevButton = document.getElementById('prev-slide');
    const nextButton = document.getElementById('next-slide');

    // Function to navigate to movie details
    function navigateToMovie(tmdbId) {
        if (!tmdbId) {
            console.warn('No TMDB ID available for navigation');
            return;
        }
        
        localStorage.setItem('tmdbMovieID', String(tmdbId));
        localStorage.setItem('tmdbMediaType', 'movie');
        localStorage.removeItem('movieID');
        localStorage.removeItem('selectedMovieID');
        window.location.href = 'movies.html';
    }

    async function loadFiscusPosterImages() {
        const fiscusList = document.getElementById('popularfiscus');
        if (!fiscusList) {
            console.log('Fiscus list not found');
            return;
        }

        const movieItems = fiscusList.querySelectorAll('.movie-poster-box');
        const apiKey = getTmdbApiKey();
        if (!apiKey) {
            console.error('No TMDB API key found');
            return;
        }

        const safePlayIcon = escapeHtml(HOME_ACTION_ICONS.watch);
        const safeWatchlistIcon = escapeHtml(HOME_ACTION_ICONS.watchlist);
        const safeFavoriteIcon = escapeHtml(HOME_ACTION_ICONS.favorite);

        for (let i = 0; i < movieItems.length; i++) {
            const item = movieItems[i];
            const movieTitle = item.dataset.movieTitle;
            if (!movieTitle) {
                continue;
            }

            let matchedMovie = null;
            try {
                const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movieTitle)}&language=en-US`;
                const response = await fetch(searchUrl);
                if (response.ok) {
                    const data = await response.json();
                    if (data.results && data.results.length > 0) {
                        matchedMovie = data.results[0];
                    }
                }
            } catch (error) {
                console.error(`Failed to load poster for ${movieTitle}:`, error);
            }

            const posterPath = matchedMovie && matchedMovie.poster_path
                ? `${TMDB_IMAGE_BASE}${matchedMovie.poster_path}`
                : 'https://via.placeholder.com/300x450?text=No+Poster';
            const resolvedTitle = matchedMovie && matchedMovie.title ? matchedMovie.title : movieTitle;
            const resolvedYear = matchedMovie && matchedMovie.release_date
                ? matchedMovie.release_date.split('-')[0]
                : '';
            const resolvedTmdbId = matchedMovie && matchedMovie.id ? String(matchedMovie.id) : '';

            item.classList.add('home-rail-card');
            item.dataset.tmdbId = resolvedTmdbId;
            item.dataset.mediaType = 'movie';
            item.dataset.movieTitle = resolvedTitle;
            item.dataset.movieYear = resolvedYear;
            item.dataset.moviePoster = posterPath;

            const safeTitle = escapeHtml(resolvedTitle);
            const safeYear = escapeHtml(resolvedYear);
            const safePoster = escapeHtml(posterPath);

            item.innerHTML = `
                <img class="recon-poster" src="${safePoster}" alt="${safeTitle}">
                <div class="home-rail-overlay">
                    <h3>${safeTitle}${safeYear ? ` (${safeYear})` : ''}</h3>
                    <p>MOVIE</p>
                    <div class="home-rail-actions">
                        <button class="home-rail-icon-btn" type="button" data-action="watch" aria-label="Play now" title="Play now">
                            <img src="${safePlayIcon}" alt="" loading="lazy">
                        </button>
                        <button class="home-rail-icon-btn" type="button" data-action="watchlist" aria-label="Add to watchlist" title="Add to watchlist" aria-pressed="false">
                            <img src="${safeWatchlistIcon}" alt="" loading="lazy">
                        </button>
                        <button class="home-rail-icon-btn" type="button" data-action="favorite" aria-label="Add to favorite" title="Add to favorite" aria-pressed="false">
                            <img src="${safeFavoriteIcon}" alt="" loading="lazy">
                        </button>
                    </div>
                </div>
            `;

            if (i < movieItems.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (fiscusList.dataset.actionsBound !== 'true') {
            fiscusList.addEventListener('click', async (event) => {
                const actionBtn = event.target.closest('[data-action]');
                const cardEl = event.target.closest('.home-rail-card');
                if (!cardEl) {
                    return;
                }

                if (actionBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = actionBtn.dataset.action;

                    if (action === 'watch' && !cardEl.dataset.tmdbId) {
                        await searchAndNavigateToMovie(cardEl.dataset.movieTitle || '');
                        return;
                    }

                    await handleHomeRailAction(cardEl, action);
                    return;
                }

                if (cardEl.dataset.tmdbId) {
                    openHomeRailMovie(cardEl);
                } else {
                    await searchAndNavigateToMovie(cardEl.dataset.movieTitle || '');
                }
            });

            fiscusList.dataset.actionsBound = 'true';
        }
    }

    async function searchAndNavigateToMovie(movieTitle) {
        if (!movieTitle || !movieTitle.trim()) {
            console.warn('No movie title provided');
            return;
        }

        try {
            const apiKey = getTmdbApiKey();
            if (!apiKey) {
                console.warn('TMDB API key not found');
                return;
            }

            const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movieTitle)}&language=en-US`;
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                console.warn('Failed to search for movie:', movieTitle);
                return;
            }

            const data = await response.json();
            const results = data.results || [];
            
            if (results.length === 0) {
                console.warn('No results found for movie:', movieTitle);
                return;
            }

            // Use the first result
            const movie = results[0];
            navigateToMovie(movie.id);
        } catch (error) {
            console.error('Error searching for movie:', error);
        }
    }

    // Fetch trending movies or use fallback
    let contentArray = await fetchTrendingMoviesForHomepage();
    
    if (!contentArray) {
        // Fallback content if API fails
        contentArray = [
            {
                tmdbId: null,
                title: "500 Days of Summer",
                rating: "7.7/10",
                description: "Tom, greeting-card writer and hopeless romantic, is caught completely off-guard when his girlfriend, Summer, suddenly dumps him. He reflects on their 500 days together to try to figure out where their love affair went sour, and in doing so, Tom rediscovers his true passions in life.",
                backdropPath: "",
                logoUrl: ""
            },
            {
                tmdbId: null,
                title: "Whiplash",
                rating: "8.5/10",
                description: "Under the direction of a ruthless instructor, a talented young drummer begins to pursue perfection at any cost, even his humanity.",
                backdropPath: "",
                logoUrl: ""
            },
            {
                tmdbId: null,
                title: "Everything Everywhere All at Once",
                rating: "7.8/10",
                description: "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save what's important to her by connecting with the lives she could have led in other universes.",
                backdropPath: "",
                logoUrl: ""
            },
            {
                tmdbId: null,
                title: "Joker: Folie à Deux",
                rating: "5.2/10",
                description: "While struggling with his dual identity, Arthur Fleck not only stumbles upon true love, but also finds the music that's always been inside him.",
                backdropPath: "",
                logoUrl: ""
            },
            {
                tmdbId: null,
                title: "Past Lives",
                rating: "7.8/10",
                description: "Nora and Hae Sung, two childhood friends, are reunited in New York for one fateful week as they confront notions of destiny, love, and the choices that make a life.",
                backdropPath: "",
                logoUrl: ""
            },
            {
                tmdbId: null,
                title: "Miracle in Cell no 7",
                rating: "8.2/10",
                description: "Separated from his daughter, a father with an intellectual disability must prove his innocence when he is jailed for the death of a commander's child.",
                backdropPath: "",
                logoUrl: ""
            },
            {
                tmdbId: null,
                title: "The Perks of Being a Wallflower",
                rating: "7.9/10",
                description: "Pittsburgh, Pennsylvania, 1991. High school freshman Charlie is a wallflower, always watching life from the sidelines, until two senior students, Sam and her stepbrother Patrick, become his mentors, helping him discover the joys of friendship, music and love.",
                backdropPath: "",
                logoUrl: ""
            },
            {
                tmdbId: null,
                title: "Memories of Murder",
                rating: "8.1/10",
                description: "During the late 1980s, two detectives in a South Korean province attempt to solve the nation's first series of rape-and-murder cases.",
                backdropPath: "",
                logoUrl: ""
            }
        ];
        totalSlides = contentArray.length;
    }

    function updateSlide() {
        const content = contentArray[currentSlide - 1];
        
        if (bodyPoster) {
            if (content.backdropPath) {
                bodyPoster.style.backgroundImage = `linear-gradient(94deg, rgba(13,27,42,0.8842130602240896) 62%, rgba(119,141,169,0.5648853291316527) 94%), url('${content.backdropPath}')`;
                bodyPoster.style.backgroundRepeat = "no-repeat";
                bodyPoster.style.backgroundSize = "cover";
                bodyPoster.style.backgroundPosition = "center";
            } else {
                bodyPoster.style.backgroundImage = "linear-gradient(94deg, rgba(13,27,42,0.8842130602240896) 62%, rgba(119,141,169,0.5648853291316527) 94%), url(./images/500daysofsummer.avif)";
            }
        }

        bodyMainDiv.innerHTML = `
            <div class="body-title">${content.logoUrl ? `<img class="movie-hero-logo" src="${content.logoUrl}" alt="${content.title} logo" style="max-width: 100%; max-height: 150px; object-fit: contain;">` : `<h1>${content.title}</h1>`}</div>
            <div class="body-rating"><h1>Rating: ${content.rating}</h1></div>
            <div class="body-description"><p>${content.description}</p></div>
            <div class="body-buttons">
                <button class="body-button" onclick="window.carouselNavigateToMovie(${content.tmdbId})"><span class="button-body-text">Play Now</span></button>
                <button class="body-button2" onclick="window.carouselNavigateToMovie(${content.tmdbId})"><span class="button-body-text">More Info</span></button>
            </div>
        `;
    }

    function nextSlide() {
        currentSlide = currentSlide < totalSlides ? currentSlide + 1 : 1;
        updateSlide();
    }

    function prevSlide() {
        currentSlide = currentSlide > 1 ? currentSlide - 1 : totalSlides;
        updateSlide();
    }

    nextButton.addEventListener('click', () => {
        clearInterval(autoSlide);
        nextSlide();
        autoSlide = setInterval(nextSlide, intervalTime);
    });

    prevButton.addEventListener('click', () => {
        clearInterval(autoSlide);
        prevSlide();
        autoSlide = setInterval(nextSlide, intervalTime);
    });

    let autoSlide = setInterval(nextSlide, intervalTime);

    // Expose navigation function to global scope for onclick handlers
    window.carouselNavigateToMovie = navigateToMovie;
    window.searchAndNavigateToMovie = searchAndNavigateToMovie;

    updateSlide();
    loadFiscusPosterImages();
});




const movieSearchBox = document.getElementById('movie-search-box');
const searchList = document.getElementById('search-list');
const resultGrid = document.getElementById('result-grid');


async function loadMovies(searchTerm){
    const tmdbApiKey = getTmdbApiKey();
    if (!tmdbApiKey) {
        return;
    }

    const URL = `${TMDB_BASE_URL}/search/multi?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchTerm)}&include_adult=false&page=1`;
    const res = await fetch(URL);
    const data = await res.json();
    const mediaResults = (data.results || []).filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
    displayMovieList(mediaResults);
}

function findMovies(){
    let searchTerm = (movieSearchBox.value).trim();
    if(searchTerm.length > 0){
        searchList.classList.remove('hide-search-list');
        loadMovies(searchTerm);
    } else {
        searchList.classList.add('hide-search-list');
    }
}

function displayMovieList(movies){
    searchList.innerHTML = "";

    if (!movies.length) {
        searchList.classList.add('hide-search-list');
        return;
    }

    for(let idx = 0; idx < movies.length; idx++){
        let movieListItem = document.createElement('div');
        movieListItem.dataset.id = movies[idx].id;
        movieListItem.dataset.mediaType = movies[idx].media_type || 'movie';
        movieListItem.classList.add('search-list-item');
        const moviePoster = movies[idx].poster_path
            ? `${TMDB_IMAGE_BASE}${movies[idx].poster_path}`
            : "https://via.placeholder.com/300x450?text=No+Poster";
        const mediaTitle = movies[idx].title || movies[idx].name || 'Untitled';
        const mediaDate = movies[idx].release_date || movies[idx].first_air_date;
        const movieYear = mediaDate ? mediaDate.split("-")[0] : "N/A";
        const mediaLabel = (movies[idx].media_type || 'movie').toUpperCase();

        movieListItem.innerHTML = `
        <div class = "search-item-thumbnail">
            <img src = "${moviePoster}">
        </div>
        <div class = "search-item-info">
            <h3>${mediaTitle}</h3>
            <p>${movieYear} • ${mediaLabel}</p>
        </div>
        `;
        searchList.appendChild(movieListItem);
    }
    loadMovieDetails();
}

// function loadMovieDetails(){
//     const searchListMovies = searchList.querySelectorAll('.search-list-item');
//     searchListMovies.forEach(movie => {
//         movie.addEventListener('click', async () => {
//             // console.log(movie.dataset.id);
//             searchList.classList.add('hide-search-list');
//             movieSearchBox.value = "";
//             const result = await fetch(`http://www.omdbapi.com/?i=${movie.dataset.id}&apikey=620186d3`);
//             const movieDetails = await result.json();
//             // console.log(movieDetails);
//             displayMovieDetails(movieDetails);
//         });
//     });
// }

function loadMovieDetails() {
    const searchListMovies = searchList.querySelectorAll('.search-list-item');
    searchListMovies.forEach(movie => {
        movie.addEventListener('click', () => {
            const titleEl = movie.querySelector('.search-item-info h3');
            const yearEl = movie.querySelector('.search-item-info p');
            const posterEl = movie.querySelector('.search-item-thumbnail img');
            if (window.FiscusAuth && window.FiscusAuth.addSearchHistory) {
                window.FiscusAuth.addSearchHistory({
                    tmdb_id: movie.dataset.id,
                    media_type: movie.dataset.mediaType || 'movie',
                    title: titleEl ? titleEl.textContent : 'Unknown',
                    year: yearEl ? yearEl.textContent : 'N/A',
                    poster: posterEl ? posterEl.src : ''
                });
            }

            searchList.classList.add('hide-search-list');
            movieSearchBox.value = "";
            localStorage.setItem('tmdbMovieID', movie.dataset.id);
            localStorage.setItem('tmdbMediaType', movie.dataset.mediaType || 'movie');
            localStorage.removeItem('movieID');
            window.location.href = 'movies.html';
        });
    });
}

window.addEventListener('click', (event) => {
    if(event.target.className != "form-control"){
        searchList.classList.add('hide-search-list');
    }
});




