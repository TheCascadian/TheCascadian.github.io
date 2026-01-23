(function () {
  const WORDS_PER_MINUTE = 200;
  const READING_TIME_BUFFER = 1.1;

  function calculateReadingTime() {
    const articleContent = document.querySelector('.article-content');
    if (!articleContent) return;

    const text = articleContent.innerText || articleContent.textContent;
    const wordCount = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil((wordCount / WORDS_PER_MINUTE) * READING_TIME_BUFFER);

    const readingTimeElement = document.querySelector('.reading-time');
    if (readingTimeElement) {
      readingTimeElement.textContent = readingTime + ' min read';
    }
  }

  function generateTableOfContents() {
    const articleContent = document.querySelector('.article-content');
    const tocContainer = document.querySelector('.article-toc ul');
    if (!articleContent || !tocContainer) return;

    const headings = articleContent.querySelectorAll('h2, h3');
    if (headings.length === 0) {
      const tocElement = document.querySelector('.article-toc');
      if (tocElement) tocElement.style.display = 'none';
      return;
    }

    headings.forEach((heading, index) => {
      const id = 'heading-' + index;
      heading.id = id;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = heading.textContent;
      
      if (heading.tagName === 'H3') {
        li.style.marginLeft = '20px';
      }

      li.appendChild(a);
      tocContainer.appendChild(li);
    });

    const tocLinks = tocContainer.querySelectorAll('a');
    tocLinks.forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function init() {
    calculateReadingTime();
    generateTableOfContents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();