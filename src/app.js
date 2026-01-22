/**
 * BLOG ENGINE
 * Simple router that handles fetching and displaying content.
 */

const app = document.getElementById('app');

// 1. Fetch posts from the JSON file
async function fetchPosts() {
    const response = await fetch('posts.json');
    return await response.json();
}

// 2. Render the list of all blog posts
async function renderHome() {
    const posts = await fetchPosts();
    app.innerHTML = posts.map(post => `
        <article class="post-preview" onclick="route('post', '${post.id}')">
            <span class="post-date">${post.date}</span>
            <h2>${post.title}</h2>
            <p>${post.excerpt}</p>
        </article>
    `).join('');
}

// 3. Render a single full article
async function renderPost(postId) {
    const posts = await fetchPosts();
    const post = posts.find(p => p.id === postId);
    
    app.innerHTML = `
        <article class="full-post">
            <a href="#" onclick="route('home')" style="color: var(--muted); font-size: 0.8rem;">&larr; Back</a>
            <p class="post-date" style="margin-top: 2rem;">${post.date}</p>
            <h1>${post.title}</h1>
            <div class="content">${post.content}</div>
        </article>
    `;
}

// 4. Simple Router
function route(type, id = null) {
    window.scrollTo(0, 0); // Reset scroll to top
    if (type === 'home') renderHome();
    if (type === 'post') renderPost(id);
}

// Initialize the blog on home page
route('home');