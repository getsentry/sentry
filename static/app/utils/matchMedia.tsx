import {NODE_ENV} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';

function changeFavicon(theme: 'dark' | 'light'): void {
  // only on prod because we have a development favicon
  if (NODE_ENV !== 'production') {
    return;
  }

  const faviconNode = document.querySelector<HTMLLinkElement>(
    '[rel="icon"][type="image/png"]'
  );

  if (faviconNode === null) {
    return;
  }

  const path = faviconNode.href.split('/sentry/')[0];
  const iconName = theme === 'dark' ? 'favicon-dark' : 'favicon';

  faviconNode.href = `${path}/sentry/images/${iconName}.png`;
}

function updateTheme(theme: 'dark' | 'light') {
  const user = ConfigStore.get('user');

  if (user?.options.theme === 'system') {
    return;
  }

  ConfigStore.set('theme', theme);
}

function handleColorSchemeChange(e: MediaQueryListEvent): void {
  const isDark = e.media === '(prefers-color-scheme: dark)' && e.matches;
  const type = isDark ? 'dark' : 'light';
  changeFavicon(type);
  updateTheme(type);
}

export function setupColorScheme(): void {
  // If matchmedia is not supported, keep whatever configStore.init theme was set to
  if (!window.matchMedia) {
    return;
  }

  // Watch for changes in preferred color scheme
  const lightMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Set favicon to dark on load if necessary
  if (darkMediaQuery.matches) {
    changeFavicon('dark');
    updateTheme('dark');
  }

  lightMediaQuery.addEventListener('change', handleColorSchemeChange);
  darkMediaQuery.addEventListener('change', handleColorSchemeChange);
}
