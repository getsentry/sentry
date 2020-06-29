function changeFavicon(theme: 'dark' | 'light'): void {
  const n = document.querySelector<HTMLLinkElement>('[rel="icon"][type="image/png"]');
  if (!n) {
    return;
  }

  const path = n.href.split('/sentry/')[0];
  n.href = `${path}/sentry/images/${theme === 'dark' ? 'favicon-dark' : 'favicon'}.png`;
}

function prefersDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const updateFavicon = () => changeFavicon(prefersDark() ? 'dark' : 'light');

export function setupFavicon() {
  // Set favicon to dark on load
  if (prefersDark()) {
    updateFavicon();
  }

  // Watch for changes in preferred color scheme
  window.matchMedia('(prefers-color-scheme: dark)').addListener(updateFavicon);
}
