import {useEffect} from 'react';

import {NODE_ENV} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {useUser} from 'sentry/utils/useUser';

import useMedia from './useMedia';

function setFaviconTheme(theme: 'dark' | 'light'): void {
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

export function useColorscheme() {
  const user = useUser();
  const configuredTheme = user?.options?.theme ?? 'system';

  const preferDark = useMedia('(prefers-color-scheme: dark)');
  const preferredTheme = preferDark ? 'dark' : 'light';

  useEffect(() => {
    const theme = configuredTheme === 'system' ? preferredTheme : configuredTheme;

    setFaviconTheme(preferredTheme);
    ConfigStore.set('theme', theme);
  }, [configuredTheme, preferredTheme]);
}
