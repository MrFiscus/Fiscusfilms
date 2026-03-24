document.addEventListener("DOMContentLoaded", () => {
  const navBar = document.getElementById("navbar");
  const navMenu = document.querySelector(".nav-bar-sub");
  const navToggle = document.getElementById("nav-toggle");

  if (!navBar || !navMenu || !navToggle) {
    return;
  }

  function closeMenu() {
    navBar.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  navToggle.addEventListener("click", () => {
    const nextOpen = !navBar.classList.contains("nav-open");
    navBar.classList.toggle("nav-open", nextOpen);
    navToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  });

  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        closeMenu();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth > 900) {
      return;
    }

    if (!navBar.contains(event.target)) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      closeMenu();
    }
  });

  // Scroll detection for navbar background
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navBar.classList.add("nav-colored");
    } else {
      navBar.classList.remove("nav-colored");
    }
  });
});
