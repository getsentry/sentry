import {Fragment, useCallback, useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {IconMoon} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
// eslint-disable-next-line no-restricted-imports
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

interface ThemeToggleProps {
  children: React.ReactNode;
}

export function ThemeToggle({children}: ThemeToggleProps) {
  const config = useLegacyStore(ConfigStore);

  const [localThemeName, setLocalThemeName] = useState(config.theme);

  const localThemeValue = localThemeName === 'dark' ? darkTheme : lightTheme;

  return (
    <Fragment>
      <Inset>
        <Tabs
          value={localThemeName}
          onChange={() => setLocalThemeName(localThemeName === 'dark' ? 'light' : 'dark')}
        >
          <TabList>
            <TabList.Item key="light">Light Theme</TabList.Item>
            <TabList.Item key="dark">Dark Theme</TabList.Item>
          </TabList>
        </Tabs>
      </Inset>
      <ThemeProvider theme={localThemeValue as any}>
        <Background>
          <div>{children}</div>
        </Background>
      </ThemeProvider>
    </Fragment>
  );
}

const Inset = styled('div')`
  padding-inline: ${p => p.theme.space.md};
`;
const Background = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  flex-direction: column;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
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
