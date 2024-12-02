const nav = document.getElementById('navbar');
window.addEventListener('scroll', () =>{

    if(window.scrollY > 40){
        nav.classList.add('nav-colored');
    } else if (window.scrollY <=40){
        nav.classList.remove('nav-colored');
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const movieList = document.querySelector(".movie-list");
    const nextSlide = document.getElementById("recom-next-slide");
    const prevSlide = document.getElementById("recom-prev-slide");
    
    let currentPosition = 0;
    const slideWidth = 160; 
    const visibleSlides = 5; 


    nextSlide.addEventListener("click", () => {
        if (currentPosition > -((movieList.children.length - visibleSlides) * slideWidth)) {
            currentPosition -= slideWidth;
            movieList.style.transform = `translateX(${currentPosition}px)`;
        }
    });

    
    prevSlide.addEventListener("click", () => {
        if (currentPosition < 0) {
            currentPosition += slideWidth;
            movieList.style.transform = `translateX(${currentPosition}px)`;
        }
    });
});



document.addEventListener("DOMContentLoaded", () => {
    const movieList = document.querySelector(".series-list");
    const nextSlide = document.getElementById("series-next-slide");
    const prevSlide = document.getElementById("series-prev-slide");
    
    let currentPosition = 0;
    const slideWidth = 160; 
    const visibleSlides = 5; 

    
    nextSlide.addEventListener("click", () => {
        if (currentPosition > -((movieList.children.length - visibleSlides) * slideWidth)) {
            currentPosition -= slideWidth;
            movieList.style.transform = `translateX(${currentPosition}px)`;
        }
    });


    prevSlide.addEventListener("click", () => {
        if (currentPosition < 0) {
            currentPosition += slideWidth;
            movieList.style.transform = `translateX(${currentPosition}px)`;
        }
    });
});



document.addEventListener("DOMContentLoaded", () => {
    const movieList = document.querySelector(".fiscus-list");
    const nextSlide = document.getElementById("fiscus-next-slide");
    const prevSlide = document.getElementById("fiscus-prev-slide");
    
    let currentPosition = 0;
    const slideWidth = 160; 
    const visibleSlides = 5; 

    nextSlide.addEventListener("click", () => {
        if (currentPosition > -((movieList.children.length - visibleSlides) * slideWidth)) {
            currentPosition -= slideWidth;
            movieList.style.transform = `translateX(${currentPosition}px)`;
        }
    });

   
    prevSlide.addEventListener("click", () => {
        if (currentPosition < 0) {
            currentPosition += slideWidth;
            movieList.style.transform = `translateX(${currentPosition}px)`;
        }
    });
});





document.addEventListener("DOMContentLoaded", () => {
    let currentSlide = 1;
    const totalSlides = 8; 
    const intervalTime = 10000; 

    
    const bodyPoster = document.querySelector('.body-poster');
    const bodyMainDiv = document.querySelector('.body-main');
    const prevButton = document.getElementById('prev-slide');
    const nextButton = document.getElementById('next-slide');

    
    const contentArray = [
        {
            title: "500 Days of Summer",
            rating: "7.7/10",
            description: "Tom, greeting-card writer and hopeless romantic, is caught completely off-guard when his girlfriend, Summer, suddenly dumps him. He reflects on their 500 days together to try to figure out where their love affair went sour, and in doing so, Tom rediscovers his true passions in life.",
            playLink: "http://example.com/play1",
            infoLink: "http://example.com/info1"
        },
        {
            title: "Whiplash",
            rating: "8.5/10",
            description: "Under the direction of a ruthless instructor, a talented young drummer begins to pursue perfection at any cost, even his humanity.",
            playLink: "http://example.com/play2",
            infoLink: "http://example.com/info2"
        },
        {
            title: "Everything Everywhere All at Once",
            rating: "7.8/10",
            description: "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save what’s important to her by connecting with the lives she could have led in other universes.",
            playLink: "http://example.com/play3",
            infoLink: "http://example.com/info3"
        },
        {
            title: "Joker: Folie à Deux",
            rating: "5.2/10",
            description: "While struggling with his dual identity, Arthur Fleck not only stumbles upon true love, but also finds the music that’s always been inside him.",
            playLink: "http://example.com/play3",
            infoLink: "http://example.com/info3"
        },
        {
            title: "Past Lives",
            rating: "7.8/10",
            description: "Nora and Hae Sung, two childhood friends, are reunited in New York for one fateful week as they confront notions of destiny, love, and the choices that make a life.",
            playLink: "http://example.com/play3",
            infoLink: "http://example.com/info3"
        },
        {
            title: "Miracle in Cell no 7",
            rating: "8.2/10",
            description: "Separated from his daughter, a father with an intellectual disability must prove his innocence when he is jailed for the death of a commander’s child.",
            playLink: "http://example.com/play3",
            infoLink: "http://example.com/info3"
        },
        {
            title: "The Perks of Being a Wallflower",
            rating: "7.9/10",
            description: "Pittsburgh, Pennsylvania, 1991. High school freshman Charlie is a wallflower, always watching life from the sidelines, until two senior students, Sam and her stepbrother Patrick, become his mentors, helping him discover the joys of friendship, music and love.",
            playLink: "http://example.com/play3",
            infoLink: "http://example.com/info3"
        },
        {
            title: "Memories of Murder",
            rating: "8.1/10",
            description: "During the late 1980s, two detectives in a South Korean province attempt to solve the nation’s first series of rape-and-murder cases.",
            playLink: "http://example.com/play3",
            infoLink: "http://example.com/info3"
        }
    ];

    
    function updateSlide() {
        
        if (bodyPoster) {
            bodyPoster.className = `body-poster body-poster${currentSlide}`;
        }

       
        const content = contentArray[currentSlide - 1]; 
        bodyMainDiv.innerHTML = `
            <div class="body-title"><h1>${content.title}</h1></div>
            <div class="body-rating"><h1>Rating: ${content.rating}</h1></div>
            <div class="body-description"><p>${content.description}</p></div>
            <div class="body-buttons">
                <button class="body-button"><a href="${content.playLink}"><span class="button-body-text">Play Now</span></a></button>
                <button class="body-button2"><a href="${content.infoLink}"><span class="button-body-text">More Info</span></a></button>
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

   
    updateSlide();
});


// Titles: https://omdbapi.com/?s=thor&page=1&apikey=620186d3
// details: http://www.omdbapi.com/?i=tt3896198&apikey=620186d3

const movieSearchBox = document.getElementById('movie-search-box');
const searchList = document.getElementById('search-list');
const resultGrid = document.getElementById('result-grid');


async function loadMovies(searchTerm){
    const URL = `https://omdbapi.com/?s=${searchTerm}&page=1&apikey=620186d3`;
    const res = await fetch(`${URL}`);
    const data = await res.json();
    // console.log(data.Search);
    if(data.Response == "True") displayMovieList(data.Search);
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
    for(let idx = 0; idx < movies.length; idx++){
        let movieListItem = document.createElement('div');
        movieListItem.dataset.id = movies[idx].imdbID; // movie id in  data-id
        movieListItem.classList.add('search-list-item');
        if(movies[idx].Poster != "N/A")
            moviePoster = movies[idx].Poster;
        else 
            moviePoster = "image_not_found.png";

        movieListItem.innerHTML = `
        <div class = "search-item-thumbnail">
            <img src = "${moviePoster}">
        </div>
        <div class = "search-item-info">
            <h3>${movies[idx].Title}</h3>
            <p>${movies[idx].Year}</p>
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
            searchList.classList.add('hide-search-list');
            movieSearchBox.value = "";
            localStorage.setItem('movieID', movie.dataset.id); 
            window.location.href = 'movies.html'; // Redirect to movies.html
        });
    });
}


// function displayMovieDetails(details){
//     resultGrid.innerHTML = `
//     <div class = "movie-poster">
//         <img src = "${(details.Poster != "N/A") ? details.Poster : "image_not_found.png"}" alt = "movie poster">
//     </div>
//     <div class = "movie-info">
//         <h3 class = "movie-title">${details.Title}</h3>
//         <ul class = "movie-misc-info">
//             <li class = "year">Year: ${details.Year}</li>
//             <li class = "rated">Ratings: ${details.Rated}</li>
//             <li class = "released">Released: ${details.Released}</li>
//         </ul>
//         <p class = "genre"><b>Genre:</b> ${details.Genre}</p>
//         <p class = "writer"><b>Writer:</b> ${details.Writer}</p>
//         <p class = "actors"><b>Actors: </b>${details.Actors}</p>
//         <p class = "plot"><b>Plot:</b> ${details.Plot}</p>
//         <p class = "language"><b>Language:</b> ${details.Language}</p>
//         <p class = "awards"><b><i class = "fas fa-award"></i></b> ${details.Awards}</p>
//         <p class = "imdb-id"><b>IMDb ID:</b> ${details.imdbID}</p>


//     </div>
//     `;
// }

function displayMovieDetails(details){
    let embedLink = '';

    
    if (details.Type === 'series') {
        const seasonNumber = 1;
        const episodeNumber = 1;
        embedLink = `https://embed.su/embed/tv/${details.imdbID}/${seasonNumber}/${episodeNumber}`;
    } else if (details.Type === 'movie') {
        embedLink = `https://embed.su/embed/movie/${details.imdbID}`;
    }

    resultGrid.innerHTML = `
    <div class = "movie-poster">
        <img src = "${(details.Poster != "N/A") ? details.Poster : "image_not_found.png"}" alt = "movie poster">
    </div>
    <div class = "movie-info">
        <h3 class = "movie-title">${details.Title}</h3>
        <ul class = "movie-misc-info">
            <li class = "year">Year: ${details.Year}</li>
            <li class = "rated">Ratings: ${details.Rated}</li>
            <li class = "released">Released: ${details.Released}</li>
        </ul>
        <p class = "genre"><b>Genre:</b> ${details.Genre}</p>
        <p class = "writer"><b>Writer:</b> ${details.Writer}</p>
        <p class = "actors"><b>Actors: </b>${details.Actors}</p>
        <p class = "plot"><b>Plot:</b> ${details.Plot}</p>
        <p class = "language"><b>Language:</b> ${details.Language}</p>
        <p class = "awards"><b><i class = "fas fa-award"></i></b> ${details.Awards}</p>
        <p class = "embed-link"><b>Watch:</b> <a href="${embedLink}" target="_blank">Click here to watch</a></p> <!-- Embed link here -->
    </div>
    `;
}

window.addEventListener('click', (event) => {
    if(event.target.className != "form-control"){
        searchList.classList.add('hide-search-list');
    }
});




