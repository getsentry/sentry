import type {ReactNode} from 'react';
import {Fragment, useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {TabList, Tabs} from 'sentry/components/tabs';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {darkTheme, lightTheme} from 'sentry/utils/theme';

interface Props {
  children: ReactNode;
}

export default function ThemeToggle({children}: Props) {
  const config = useLegacyStore(ConfigStore);
  const [themeName, setThemeName] = useState(config.theme);
  const theme = themeName === 'dark' ? darkTheme : lightTheme;

  return (
    <Fragment>
      <Inset>
        <Tabs
          value={themeName}
          onChange={() => setThemeName(themeName === 'dark' ? 'light' : 'dark')}
        >
          <TabList hideBorder>
            <TabList.Item key="light">Light Theme</TabList.Item>
            <TabList.Item key="dark">Dark Theme</TabList.Item>
          </TabList>
        </Tabs>
      </Inset>
      <ThemeProvider theme={theme}>
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
