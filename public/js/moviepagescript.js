(function () {
const movieSearchBox = document.getElementById('movie-search-box');
const searchList = document.getElementById('search-list');

const MOVIE_PAGE_TMDB_BASE_URL = "/api/tmdb";
const MOVIE_PAGE_TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

if (!movieSearchBox || !searchList) {
    return;
}

async function loadMovies(searchTerm){
    const URL = `${MOVIE_PAGE_TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(searchTerm)}&include_adult=false&page=1`;
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
            ? `${MOVIE_PAGE_TMDB_IMAGE_BASE}${movies[idx].poster_path}`
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
            <p>${movieYear} &bull; ${mediaLabel}</p>
        </div>
        `;
        searchList.appendChild(movieListItem);
    }
    loadMovieDetails();
}

function loadMovieDetails() {
    const searchListMovies = searchList.querySelectorAll('.search-list-item');
    searchListMovies.forEach(movie => {
        movie.addEventListener('click', async () => {
            const titleEl = movie.querySelector('.search-item-info h3');
            const yearEl = movie.querySelector('.search-item-info p');
            const posterEl = movie.querySelector('.search-item-thumbnail img');
            if (window.FiscusAuth && window.FiscusAuth.addSearchHistory) {
                await window.FiscusAuth.addSearchHistory({
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
            localStorage.removeItem('selectedMovieID');
            window.location.href = `movies.html?tmdb=${encodeURIComponent(movie.dataset.id)}&type=${encodeURIComponent(movie.dataset.mediaType || 'movie')}`;
        });
    });
}

window.addEventListener('click', (event) => {
    if (!event.target.closest('.container')) {
        searchList.classList.add('hide-search-list');
    }
});

// movies.html uses inline handlers (onkeyup/onclick), so keep this available globally.
window.findMovies = findMovies;
})();
