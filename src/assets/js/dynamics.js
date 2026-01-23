// assets/js/measurement.js
(function () {
  const nav = document.getElementById('nav-container');
  const root = document.documentElement;

  let resultsEl = null;
  let resizeObserver = null;

  function isBottomDocked() {
    return nav.classList.contains('dock-bottom');
  }

  function findResultsElement() {
    return document.querySelector('.pagefind-ui__results');
  }

  function updateHeight() {
    if (!resultsEl || !isBottomDocked()) {
      root.style.setProperty('--pagefind-results-height', '0px');
      return;
    }

    const rect = resultsEl.getBoundingClientRect();
    const height = rect.height;

    root.style.setProperty('--pagefind-results-height', height > 0 ? `${height}px` : '0px');
  }

  function attachObserver() {
    if (resizeObserver || !resultsEl) return;

    resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(resultsEl);
  }

  function detachObserver() {
    if (!resizeObserver) return;

    resizeObserver.disconnect();
    resizeObserver = null;
    root.style.setProperty('--pagefind-results-height', '0px');
  }

  function reconcileState() {
    resultsEl = findResultsElement();

    if (isBottomDocked() && resultsEl) {
      attachObserver();
      updateHeight();
    } else {
      detachObserver();
    }
  }

  // Observe navbar class changes (dock transitions)
  const navClassObserver = new MutationObserver(reconcileState);
  navClassObserver.observe(nav, { attributes: true, attributeFilter: ['class'] });

  // Poll once Pagefind initializes (it renders asynchronously)
  const pagefindInitInterval = setInterval(() => {
    const el = findResultsElement();
    if (el) {
      resultsEl = el;
      reconcileState();
      clearInterval(pagefindInitInterval);
    }
  }, 50);

  // Safety: viewport resize
  window.addEventListener('resize', updateHeight);
})();
