import {NODE_ENV} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';

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
  ConfigStore.updateTheme(type);
}

function prefersDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function setupColorScheme(): void {
  // Set favicon to dark on load if necessary)
  if (prefersDark()) {
    changeFavicon('dark');
    ConfigStore.updateTheme('dark');
  }

  // If matchmedia is not supported, keep whatever configStore.init theme was set to
  if (!window.matchMedia) {
    return;
  }

  // Watch for changes in preferred color scheme
  const lightMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  try {
    lightMediaQuery.addEventListener('change', handleColorSchemeChange);
    darkMediaQuery.addEventListener('change', handleColorSchemeChange);
  } catch (err) {
    // Safari 13 (maybe lower too) does not support `addEventListener`
    // `addListener` is deprecated
    lightMediaQuery.addListener(handleColorSchemeChange);
    darkMediaQuery.addListener(handleColorSchemeChange);
  }
}
