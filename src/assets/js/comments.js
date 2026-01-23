(function () {
  const commentsButton = document.getElementById('comments-button');
  const commentsPanel = document.getElementById('comments-panel');
  const commentsClose = document.getElementById('comments-close');

  if (commentsButton) {
    commentsButton.addEventListener('click', function () {
      commentsPanel.classList.add('active');
    });
  }

  if (commentsClose) {
    commentsClose.addEventListener('click', function () {
      commentsPanel.classList.remove('active');
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && commentsPanel.classList.contains('active')) {
      commentsPanel.classList.remove('active');
    }
  });
})();
