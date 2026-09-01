/**
 * 主题切换逻辑：亮色/暗色模式切换 + localStorage 持久化 + 系统偏好跟随
 */

(function() {
  var STORAGE_KEY = 'theme-preference';
  var DARK = 'dark';
  var LIGHT = 'light';

  var toggleBtn = document.getElementById('theme-toggle');
  var sunIcon = document.getElementById('theme-icon-sun');
  var moonIcon = document.getElementById('theme-icon-moon');

  // ── 获取当前主题 ──

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || LIGHT;
  }

  // ── 更新图标显示 ──

  function updateIcon(theme) {
    if (!sunIcon || !moonIcon) return;
    if (theme === DARK) {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  }

  // ── 应用主题 ──

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateIcon(theme);
  }

  // ── 切换按钮点击 ──

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      var current = getTheme();
      var next = current === DARK ? LIGHT : DARK;
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
    });
  }

  // ── 监听系统主题变化（无 localStorage 时自动跟随） ──

  var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', function(e) {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? DARK : LIGHT);
    }
  });

  // ── 初始化图标状态 ──
  updateIcon(getTheme());
})();
