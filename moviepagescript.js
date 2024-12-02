const movieSearchBox = document.getElementById('movie-search-box');
const searchList = document.getElementById('search-list');
const resultGrid = document.getElementById('result-grid');

// Load movies from API based on the search term
async function loadMovies(searchTerm) {
    const URL = `https://www.omdbapi.com/?s=${searchTerm}&page=1&apikey=620186d3`; // Updated to https
    const res = await fetch(URL);
    const data = await res.json();
    if (data.Response === "True") displayMovieList(data.Search);
}

// Search for movies
function findMovies() {
    let searchTerm = movieSearchBox.value.trim();
    if (searchTerm.length > 0) {
        searchList.classList.remove('hide-search-list');
        loadMovies(searchTerm);
    } else {
        searchList.classList.add('hide-search-list');
    }
}

// Display the search results in a list
function displayMovieList(movies) {
    searchList.innerHTML = ""; // Clear previous results
    for (let movie of movies) {
        let movieListItem = document.createElement('div');
        movieListItem.dataset.id = movie.imdbID; // Store movie ID
        movieListItem.classList.add('search-list-item');
        let moviePoster = movie.Poster !== "N/A" ? movie.Poster : "image_not_found.png";

        movieListItem.innerHTML = `
            <div class="search-item-thumbnail">
                <img src="${moviePoster}">
            </div>
            <div class="search-item-info">
                <h3>${movie.Title}</h3>
                <p>${movie.Year}</p>
            </div>
        `;
        searchList.appendChild(movieListItem);
    }
    loadMovieDetails();
}

// Handle movie selection
function loadMovieDetails() {
    const searchListMovies = searchList.querySelectorAll('.search-list-item');
    searchListMovies.forEach(movie => {
        movie.addEventListener('click', () => {
            searchList.classList.add('hide-search-list');
            movieSearchBox.value = "";
            const movieID = movie.dataset.id;
            window.location.href = `movies.html?movieID=${movieID}`; // Redirect with movieID in the URL
        });
    });
}

// Fetch and display movie details on movies.html
async function fetchAndDisplayMovieDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieID = urlParams.get('movieID');

    if (movieID) {
        const result = await fetch(`https://www.omdbapi.com/?i=${movieID}&apikey=620186d3`); // Updated to https
        const movieDetails = await result.json();
        displayMovieDetails(movieDetails);
    }
}

// Display movie details
function displayMovieDetails(details) {
    let embedLink = '';

    if (details.Type === 'series') {
        const seasonNumber = 1;
        const episodeNumber = 1;
        embedLink = `https://embed.su/embed/tv/${details.imdbID}/${seasonNumber}/${episodeNumber}`; // Ensure https
    } else if (details.Type === 'movie') {
        embedLink = `https://embed.su/embed/movie/${details.imdbID}`; // Ensure https
    }

    resultGrid.innerHTML = `
        <div class="movie-poster">
            <img src="${details.Poster !== "N/A" ? details.Poster : "image_not_found.png"}" alt="movie poster">
        </div>
        <div class="movie-info">
            <h3 class="movie-title">${details.Title}</h3>
            <ul class="movie-misc-info">
                <li class="year">Year: ${details.Year}</li>
                <li class="rated">Ratings: ${details.Rated}</li>
                <li class="released">Released: ${details.Released}</li>
            </ul>
            <p class="genre"><b>Genre:</b> ${details.Genre}</p>
            <p class="writer"><b>Writer:</b> ${details.Writer}</p>
            <p class="actors"><b>Actors:</b> ${details.Actors}</p>
            <p class="plot"><b>Plot:</b> ${details.Plot}</p>
            <p class="language"><b>Language:</b> ${details.Language}</p>
            <p class="awards"><b>Awards:</b> ${details.Awards}</p>
            <p class="embed-link"><b>Watch:</b> <a href="${embedLink}" target="_blank">Click here to watch</a></p>
        </div>
    `;
}

// Hide search list when clicking outside
window.addEventListener('click', (event) => {
    if (event.target.className !== "form-control") {
        searchList.classList.add('hide-search-list');
    }
});

// Event listener for movie details page
document.addEventListener('DOMContentLoaded', () => {
    if (resultGrid) {
        fetchAndDisplayMovieDetails(); // Only execute if on movies.html
    }
});
