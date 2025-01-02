/* ===========================
   FILE 3: main.js
   =========================== */

/* 
   Thoroughly commented for clarity:
   This JS file handles interactivity, animations, and event listeners,
   separating it from the HTML for modular updates.
*/

// ============== CONTACT FORM TOGGLE ==============
document.getElementById('contact-toggle').addEventListener('click', function () {
    // Grabs the container that holds the contact form
    const formContainer = document.getElementById('contact-form-container');
    // Toggles the 'hidden' class to show/hide
    formContainer.classList.toggle('hidden');
});

// ============== SMOOTH SCROLLING FOR NAV LINKS ==============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            // Offset for the fixed navigation is 80px
            window.scrollTo({
                top: target.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// ============== GSAP ANIMATIONS ==============
// Simple bounce of the 'grunge-text' element (site name, etc.)
gsap.from('.grunge-text', { 
    duration: 1.5, 
    y: -50, 
    opacity: 0, 
    ease: 'bounce' 
});

// Hero section text and button fade in with slight delay
gsap.from('.hero-section p', { 
    duration: 1.5, 
    y: 50, 
    opacity: 0, 
    delay: 0.5 
});
gsap.from('.hero-section a', { 
    duration: 1.5, 
    scale: 0.5, 
    opacity: 0, 
    delay: 1 
});

// ============== LIGHTBOX2 CONFIG ==============
lightbox.option({
    'resizeDuration': 200,
    'wrapAround': true
});

// ============== OPTIONAL MUSIC-ITEM HOVER EFFECT ==============
document.querySelectorAll('.music-item').forEach(item => {
    // Slight rotation and scale on hover
    item.addEventListener('mouseover', () => {
        gsap.to(item, { 
            rotation: 2, 
            scale: 1.03, 
            duration: 0.3 
        });
    });
    // Revert on mouse out
    item.addEventListener('mouseout', () => {
        gsap.to(item, { 
            rotation: 0, 
            scale: 1, 
            duration: 0.3 
        });
    });
});

// ============== FORM SUBMISSION LOGIC ==============
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent default form submission

        const formData = new FormData(form);
        fetch(form.action, {
            method: form.method,
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                alert('Thank you for your message! We will get back to you soon.');
                form.reset();
            } else {
                response.json().then(data => {
                    if (Object.hasOwn(data, 'errors')) {
                        alert(data.errors.map(error => error.message).join("\n"));
                    } else {
                        alert('Oops! There was a problem submitting your form.');
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Oops! There was a problem submitting your form.');
        });
    });
});

// Resize canvas on window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// ============== INTERACTIVE TIMELINE ENHANCEMENTS ==============
// Optional: Add animations or interactivity to the timeline items
const timelineItems = document.querySelectorAll('.timeline-item');

timelineItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
        gsap.to(item.querySelector('.timeline-content'), { scale: 1.05, boxShadow: '0 8px 20px rgba(255, 51, 51, 0.5)', duration: 0.3 });
    });
    item.addEventListener('mouseleave', () => {
        gsap.to(item.querySelector('.timeline-content'), { scale: 1, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', duration: 0.3 });
    });
});
