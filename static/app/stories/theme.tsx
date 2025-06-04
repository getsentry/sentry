import {Fragment, useCallback, useState} from 'react';
import type {Theme} from '@emotion/react';
import {ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {IconMoon} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
// eslint-disable-next-line no-restricted-imports -- We need to import theme as we want to locally scope the change
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {
  DO_NOT_USE_darkChonkTheme,
  DO_NOT_USE_lightChonkTheme,
} from 'sentry/utils/theme/theme.chonk';

interface ThemeToggleProps {
  children: React.ReactNode;
}

export function ThemeToggle({children}: ThemeToggleProps) {
  const theme = useTheme();
  const config = useLegacyStore(ConfigStore);

  const [localThemeName, setLocalThemeName] = useState(config.theme);

  const localThemeValue = theme.isChonk
    ? localThemeName === 'dark'
      ? DO_NOT_USE_darkChonkTheme
      : DO_NOT_USE_lightChonkTheme
    : localThemeName === 'dark'
      ? darkTheme
      : lightTheme;

  return (
    <Fragment>
      <Inset>
        <Tabs
          value={localThemeName}
          onChange={() => setLocalThemeName(localThemeName === 'dark' ? 'light' : 'dark')}
        >
          <TabList hideBorder>
            <TabList.Item key="light">Light Theme</TabList.Item>
            <TabList.Item key="dark">Dark Theme</TabList.Item>
          </TabList>
        </Tabs>
      </Inset>
      <ThemeProvider theme={localThemeValue as Theme}>
        <Background>
          <div>{children}</div>
        </Background>
      </ThemeProvider>
    </Fragment>
  );
}

const Inset = styled('div')`
  padding-inline: ${space(1)};
`;
const Background = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  background: ${p => p.theme.background};
  padding: ${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export function ThemeSwitcher() {
  const config = useLegacyStore(ConfigStore);
  const isDark = config.theme === 'dark';

  const handleClick = useCallback(() => {
    ConfigStore.set('theme', isDark ? 'light' : 'dark');
  }, [isDark]);

  return (
    <Button
      size="xs"
      onClick={handleClick}
      icon={<IconMoon />}
      aria-label={isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
      title={isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
    />
  );
}
