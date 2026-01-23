(function () {
  const nav = document.getElementById('nav-container');
  const handle = document.getElementById('drag-handle');
  const searchContainer = document.querySelector('.search-container');
  const contentContainer = document.getElementById('content');
  const overlays = {
    top: document.getElementById('overlay-top'),
    bottom: document.getElementById('overlay-bottom'),
    left: document.getElementById('overlay-left'),
    right: document.getElementById('overlay-right'),
  };

  const snapZone = 100;
  let isDragging = false;
  let sourceOrientation = null;
  let handleCenterWithinNav = { x: 0, y: 0 };
  let currentDockPosition = 'dock-top';

  function initOverlays() {
    overlays.top.style.top = '0';
    overlays.top.style.left = '0';
    overlays.top.style.width = '100vw';
    overlays.top.style.height = '50px';

    overlays.bottom.style.bottom = '0';
    overlays.bottom.style.left = '0';
    overlays.bottom.style.width = '100vw';
    overlays.bottom.style.height = '50px';

    overlays.left.style.top = '0';
    overlays.left.style.left = '0';
    overlays.left.style.width = '180px';
    overlays.left.style.height = '100vh';

    overlays.right.style.top = '0';
    overlays.right.style.right = '0';
    overlays.right.style.width = '180px';
    overlays.right.style.height = '100vh';
  }

  function updateContentPadding(dockClass) {
    if (!contentContainer) return;

    const navRect = nav.getBoundingClientRect();

    contentContainer.classList.remove('navbar-top', 'navbar-bottom', 'navbar-left', 'navbar-right');

    if (dockClass === 'dock-top') {
      contentContainer.classList.add('navbar-top');
      document.documentElement.style.setProperty('--navbar-height', `${navRect.height}px`);
      document.documentElement.style.setProperty('--navbar-width', '0px');
    } else if (dockClass === 'dock-bottom') {
      contentContainer.classList.add('navbar-bottom');
      document.documentElement.style.setProperty('--navbar-height', `${navRect.height}px`);
      document.documentElement.style.setProperty('--navbar-width', '0px');
    } else if (dockClass === 'dock-left') {
      contentContainer.classList.add('navbar-left');
      document.documentElement.style.setProperty('--navbar-width', `${navRect.width}px`);
      document.documentElement.style.setProperty('--navbar-height', '0px');
    } else if (dockClass === 'dock-right') {
      contentContainer.classList.add('navbar-right');
      document.documentElement.style.setProperty('--navbar-width', `${navRect.width}px`);
      document.documentElement.style.setProperty('--navbar-height', '0px');
    }

    currentDockPosition = dockClass;
  }

  function initializeContentPadding() {
    let initialDockClass = 'dock-top';
    if (nav.classList.contains('dock-bottom')) {
      initialDockClass = 'dock-bottom';
    } else if (nav.classList.contains('dock-left')) {
      initialDockClass = 'dock-left';
    } else if (nav.classList.contains('dock-right')) {
      initialDockClass = 'dock-right';
    }
    updateContentPadding(initialDockClass);
  }

  initOverlays();
  initializeContentPadding();

  handle.addEventListener('pointerdown', function (e) {
    e.preventDefault();

    let currentDockClass;
    if (nav.classList.contains('dock-top')) {
      currentDockClass = 'dock-top';
    } else if (nav.classList.contains('dock-bottom')) {
      currentDockClass = 'dock-bottom';
    } else if (nav.classList.contains('dock-left')) {
      currentDockClass = 'dock-left';
    } else {
      currentDockClass = 'dock-right';
    }

    sourceOrientation = {
      orientation:
        currentDockClass === 'dock-top' || currentDockClass === 'dock-bottom' ? 'horizontal' : 'vertical',
      dockClass: currentDockClass,
    };

    const currentRect = nav.getBoundingClientRect();

    nav.classList.remove('dock-top', 'dock-bottom', 'dock-left', 'dock-right');
    nav.classList.add('dragging');

    if (sourceOrientation.dockClass === 'dock-left' || sourceOrientation.dockClass === 'dock-right') {
      nav.classList.add('drag-vertical');
    } else {
      nav.classList.add('drag-horizontal');
    }

    nav.style.transition = 'none';
    nav.style.width = currentRect.width + 'px';
    nav.style.height = currentRect.height + 'px';

    if (sourceOrientation.dockClass === 'dock-left' || sourceOrientation.dockClass === 'dock-right') {
      nav.style.flexDirection = 'column';
    } else {
      nav.style.flexDirection = 'row';
    }

    nav.style.right = 'auto';
    nav.style.bottom = 'auto';

    void nav.offsetHeight;

    const navRect = nav.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    handleCenterWithinNav.x = handleRect.left + handleRect.width / 2 - navRect.left;
    handleCenterWithinNav.y = handleRect.top + handleRect.height / 2 - navRect.top;

    positionNavbar(e.clientX, e.clientY);

    isDragging = true;
    handle.setPointerCapture(e.pointerId);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  });

  function positionNavbar(mouseX, mouseY) {
    let navX = mouseX - handleCenterWithinNav.x;
    let navY = mouseY - handleCenterWithinNav.y;

    const constrained = constrainToViewport(
      navX,
      navY,
      parseFloat(nav.style.width) || nav.getBoundingClientRect().width,
      parseFloat(nav.style.height) || nav.getBoundingClientRect().height,
    );

    nav.style.left = constrained.x + 'px';
    nav.style.top = constrained.y + 'px';
  }

  function constrainToViewport(x, y, width, height) {
    const maxX = window.innerWidth - width;
    const maxY = window.innerHeight - height;

    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const targetInfo = getTargetOrientation(e.clientX, e.clientY);

    if (targetInfo.dockClass !== sourceOrientation.dockClass) {
      resizeForOrientation(targetInfo);
    }

    positionNavbar(e.clientX, e.clientY);
    updateOverlays(e.clientX, e.clientY);
  }

  function getTargetOrientation(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (y < snapZone) {
      return { orientation: 'horizontal', dockClass: 'dock-top' };
    } else if (y > h - snapZone) {
      return { orientation: 'horizontal', dockClass: 'dock-bottom' };
    } else if (x < snapZone) {
      return { orientation: 'vertical', dockClass: 'dock-left' };
    } else if (x > w - snapZone) {
      return { orientation: 'vertical', dockClass: 'dock-right' };
    }
    return { orientation: sourceOrientation.orientation, dockClass: sourceOrientation.dockClass };
  }

  function resizeForOrientation(targetInfo) {
    sourceOrientation = targetInfo;

    nav.classList.remove(
      'dragging',
      'drag-vertical',
      'drag-horizontal',
      'dock-top',
      'dock-bottom',
      'dock-left',
      'dock-right',
    );
    nav.classList.add(targetInfo.dockClass);

    nav.style.width = '';
    nav.style.height = '';
    nav.style.flexDirection = '';

    void nav.offsetHeight;

    const newRect = nav.getBoundingClientRect();

    nav.classList.remove(targetInfo.dockClass);
    nav.classList.add('dragging');

    if (targetInfo.dockClass === 'dock-left' || targetInfo.dockClass === 'dock-right') {
      nav.classList.add('drag-vertical');
    } else {
      nav.classList.add('drag-horizontal');
    }

    nav.style.transition =
      'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    nav.style.width = newRect.width + 'px';
    nav.style.height = newRect.height + 'px';
    nav.style.flexDirection = targetInfo.orientation === 'horizontal' ? 'row' : 'column';
    nav.style.right = 'auto';
    nav.style.bottom = 'auto';

    setTimeout(() => {
      if (isDragging) {
        nav.style.transition = 'none';
      }
    }, 300);

    void nav.offsetHeight;

    const navRect = nav.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    handleCenterWithinNav.x = handleRect.left + handleRect.width / 2 - navRect.left;
    handleCenterWithinNav.y = handleRect.top + handleRect.height / 2 - navRect.top;
  }

  function updateOverlays(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    Object.values(overlays).forEach((overlay) => overlay.classList.remove('active'));

    if (y < snapZone) {
      overlays.top.classList.add('active');
    } else if (y > h - snapZone) {
      overlays.bottom.classList.add('active');
    } else if (x < snapZone) {
      overlays.left.classList.add('active');
    } else if (x > w - snapZone) {
      overlays.right.classList.add('active');
    }
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    try {
      handle.releasePointerCapture && handle.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    nav.classList.remove('dragging', 'drag-vertical', 'drag-horizontal');
    Object.values(overlays).forEach((overlay) => overlay.classList.remove('active'));

    snapToPosition(e.clientX, e.clientY);
  }

  function snapToPosition(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    nav.style.transition = '';
    nav.style.left = '';
    nav.style.top = '';
    nav.style.right = '';
    nav.style.bottom = '';
    nav.style.width = '';
    nav.style.height = '';
    nav.style.flexDirection = '';

    let finalDockClass;
    if (y < snapZone) {
      finalDockClass = 'dock-top';
    } else if (y > h - snapZone) {
      finalDockClass = 'dock-bottom';
    } else if (x < snapZone) {
      finalDockClass = 'dock-left';
    } else if (x > w - snapZone) {
      finalDockClass = 'dock-right';
    } else {
      finalDockClass = 'dock-top';
    }

    nav.classList.add(finalDockClass);

    setTimeout(() => {
      updateContentPadding(finalDockClass);
    }, 0);
  }

  handle.ondragstart = () => false;

  const resizeObserver = new ResizeObserver(() => {
    if (!isDragging) {
      updateContentPadding(currentDockPosition);
    }
  });

  resizeObserver.observe(nav);

  window.addEventListener('resize', () => {
    initOverlays();
    if (!isDragging) {
      updateContentPadding(currentDockPosition);
    }
  });
})();
