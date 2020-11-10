import {NODE_ENV} from 'app/constants';
import ConfigStore from 'app/stores/configStore';

function changeFavicon(theme: 'dark' | 'light'): void {
  // only on prod because we have a development favicon
  if (NODE_ENV !== 'production') {
    return;
  }

  const n = document.querySelector<HTMLLinkElement>('[rel="icon"][type="image/png"]');
  if (!n) {
    return;
  }

  const path = n.href.split('/sentry/')[0];
  n.href = `${path}/sentry/images/${theme === 'dark' ? 'favicon-dark' : 'favicon'}.png`;
}

function handleColorSchemeChange(e: MediaQueryListEvent): void {
  const isDark = e.media === '(prefers-color-scheme: dark)' && e.matches;
  const type = isDark ? 'dark' : 'light';
  changeFavicon(type);
  // TODO(dark): For now, you must opt into dark mode using command palette
  // ConfigStore.set('theme', type);
}

export function prefersDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function setupColorScheme(): void {
  // Set favicon to dark on load if necessary)
  if (prefersDark()) {
    changeFavicon('dark');
    // TODO(dark): (currently manual opt in only): ConfigStore.set('theme', 'dark');
  }

  // Watch for changes in preferred color scheme
  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', handleColorSchemeChange);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', handleColorSchemeChange);
}
