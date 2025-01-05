/* ===========================
   FILE 3: main.js (Fixed)
=========================== */

/* 
   JavaScript for handling interactivity, animations, and event listeners.
   Ensures lyrics search functionality works correctly.
*/

// Ensure the DOM is fully loaded before executing scripts
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all functionalities
    initContactFormToggle();
    initSmoothScrolling();
    initGSAPAnimations();
    initLightbox();
    initMusicItemHoverEffects();
    initFormSubmission();
    initTimelineEnhancements();
    initSearchLyrics(); // Initialize lyrics search functionality
    initCanvasResize();
});

/* ===========================
   CONTACT FORM TOGGLE
=========================== */

/**
 * Toggles the visibility of the contact form container
 * when the contact toggle button is clicked.
 */
function initContactFormToggle() {
    const contactToggle = document.getElementById('contact-toggle');
    const formContainer = document.getElementById('contact-form-container');

    if (contactToggle && formContainer) {
        contactToggle.addEventListener('click', () => {
            formContainer.classList.toggle('hidden');
            toggleIconRotation('contact-icon');
        });
    } else {
        console.warn('Contact toggle elements not found.');
    }
}

/* ===========================
   SMOOTH SCROLLING FOR NAV LINKS
=========================== */

/**
 * Adds smooth scrolling behavior to all anchor links
 * referencing sections within the page.
 */
function initSmoothScrolling() {
    const anchors = document.querySelectorAll('a[href^="#"]');

    anchors.forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);

            if (target) {
                // Adjust scroll position for the fixed nav
                const navHeight = 80;
                const targetPosition = target.offsetTop - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ===========================
   GSAP ANIMATIONS
=========================== */

/**
 * Initializes GSAP animations for select elements on the page.
 */
function initGSAPAnimations() {
    // Animate elements with the 'grunge-text' class
    gsap.from('.grunge-text', { 
        duration: 1.5, 
        y: -50, 
        opacity: 0, 
        ease: 'bounce' 
    });

    // Animate hero section paragraph
    gsap.from('.hero-section p', { 
        duration: 1.5, 
        y: 50, 
        opacity: 0, 
        delay: 0.5 
    });

    // Animate hero section button
    gsap.from('.hero-section a', { 
        duration: 1.5, 
        scale: 0.5, 
        opacity: 0, 
        delay: 1 
    });
}

/* ===========================
   LIGHTBOX2 CONFIGURATION
=========================== */

/**
 * Configures Lightbox2 options for image galleries if Lightbox is available.
 */
function initLightbox() {
    if (typeof lightbox !== 'undefined') {
        lightbox.option({
            'resizeDuration': 200,
            'wrapAround': true
        });
    } else {
        console.warn('Lightbox2 library not loaded.');
    }
}

/* ===========================
   MUSIC ITEM HOVER EFFECTS
=========================== */

/**
 * Adds subtle hover effects to music items using GSAP.
 */
function initMusicItemHoverEffects() {
    const musicItems = document.querySelectorAll('.music-item');

    musicItems.forEach(item => {
        // Mouseover: slight rotation and scale
        item.addEventListener('mouseover', () => {
            gsap.to(item, { 
                rotation: 2, 
                scale: 1.03, 
                duration: 0.3 
            });
        });

        // Mouseout: revert rotation and scale
        item.addEventListener('mouseout', () => {
            gsap.to(item, { 
                rotation: 0, 
                scale: 1, 
                duration: 0.3 
            });
        });
    });
}

/* ===========================
   FORM SUBMISSION LOGIC
=========================== */

/**
 * Handles the contact form submission using Fetch API to send data to Formspree.
 */
function initFormSubmission() {
    const form = document.getElementById('contact-form');

    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault(); // Prevent default form submission

            const formData = new FormData(form);
            try {
                const response = await fetch(form.action, {
                    method: form.method,
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    alert('Thank you for your message! We will get back to you soon.');
                    form.reset();
                } else {
                    const data = await response.json();
                    if (data.errors && data.errors.length > 0) {
                        alert(data.errors.map(error => error.message).join("\n"));
                    } else {
                        alert('Oops! There was a problem submitting your form.');
                    }
                }
            } catch (error) {
                console.error('Form submission error:', error);
                alert('Oops! There was a problem submitting your form.');
            }
        });
    } else {
        console.warn('Contact form not found.');
    }
}

/* ===========================
   INTERACTIVE TIMELINE ENHANCEMENTS
=========================== */

/**
 * Adds interactivity to timeline items (if any exist).
 */
function initTimelineEnhancements() {
    const timelineItems = document.querySelectorAll('.timeline-item');

    timelineItems.forEach(item => {
        const content = item.querySelector('.timeline-content');
        if (content) {
            item.addEventListener('mouseenter', () => {
                gsap.to(content, { 
                    scale: 1.05, 
                    boxShadow: '0 8px 20px rgba(255, 51, 51, 0.5)', 
                    duration: 0.3 
                });
            });

            item.addEventListener('mouseleave', () => {
                gsap.to(content, { 
                    scale: 1, 
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)', 
                    duration: 0.3 
                });
            });
        }
    });
}

/* ===========================
   CANVAS RESIZE HANDLER
=========================== */

/**
 * Adjusts the size of all canvas elements on window resize to remain responsive.
 */
function initCanvasResize() {
    const canvases = document.querySelectorAll('canvas');

    canvases.forEach(canvas => {
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });

        // Initial resize to set correct dimensions
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

/* ===========================
   HELPER FUNCTION FOR ICON ROTATION
=========================== */

/**
 * Toggles rotation of a given SVG icon to indicate expanded or collapsed state.
 * @param {string} iconId - The ID of the SVG icon to rotate.
 */
function toggleIconRotation(iconId) {
    const icon = document.getElementById(iconId);
    if (icon) {
        const currentRotation = icon.style.transform;
        icon.style.transform = currentRotation === 'rotate(180deg)' ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

let currentIndex = 0;

function moveCarousel(direction) {
    const carousel = document.getElementById('carousel-items');
    const items = carousel.children;
    const totalItems = items.length;

    // Update the current index
    currentIndex = (currentIndex + direction + totalItems) % totalItems;

    // Translate the carousel
    carousel.style.transform = `translateX(-${currentIndex * 100}%)`;
}

function moveArtCarousel(direction) {
    const carousel = document.getElementById('carousel-tracks');
    const items = carousel.children;
    const totalItems = items.length;

    // Update the current index
    currentIndex = (currentIndex + direction + totalItems) % totalItems;

    // Translate the carousel
    carousel.style.transform = `translateX(-${currentIndex * 100}%)`;
}


function toggleSection(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0)';
    }
}
