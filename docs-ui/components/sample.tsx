import {createContext, useState} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {IconMoon} from 'sentry/icons';
import space from 'sentry/styles/space';
import {darkTheme, lightTheme, Theme} from 'sentry/utils/theme';

type ThemeName = 'dark' | 'light';

type Props = {
  children?: React.ReactChild;
  /**
   * Remove the outer border and padding
   */
  noBorder?: boolean;
  /**
   * Show the theme switcher, which allows for
   * switching the local theme context between
   * light and dark mode. Useful for previewing
   * components in both modes.
   */
  showThemeSwitcher?: boolean;
};

/**
 * Expose the selected theme to children of <Sample />
 */
export const SampleThemeContext = createContext<ThemeName>('light');

const Sample = ({children, showThemeSwitcher = false, noBorder = false}: Props) => {
  const [themeName, setThemeName] = useState<ThemeName>('light');

  /**
   * If theme switcher is shown, use the correct theme object based on themeName.
   * Else, fall back to the global theme object.
   */
  const globalTheme = useTheme();
  const [switcherTheme, setSwitcherTheme] = useState<Theme>(
    themeName === 'light' ? lightTheme : darkTheme
  );

  const setTheme = setSwitcherTheme;
  const theme = showThemeSwitcher ? switcherTheme : globalTheme;

  const toggleTheme = () => {
    if (themeName === 'light') {
      setThemeName('dark');
      setTheme(darkTheme);
    } else {
      setThemeName('light');
      setTheme(lightTheme);
    }
  };

  return (
    <Wrap>
      {showThemeSwitcher && (
        <ThemeSwitcher onClick={toggleTheme} active={themeName === 'dark'}>
          <IconMoon />
        </ThemeSwitcher>
      )}
      <ThemeProvider theme={theme}>
        <InnerWrap noBorder={noBorder} addTopMargin={showThemeSwitcher}>
          <SampleThemeContext.Provider value={themeName}>
            {children}
          </SampleThemeContext.Provider>
        </InnerWrap>
      </ThemeProvider>
    </Wrap>
  );
};

export default Sample;

const Wrap = styled('div')`
  position: relative;
`;

const InnerWrap = styled('div')<{addTopMargin: boolean; noBorder: boolean}>`
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  margin: ${space(2)} 0;
  color: ${p => p.theme.textColor};

  ${p =>
    !p.noBorder &&
    `
    border: solid 1px ${p.theme.border};
    background: ${p.theme.background};
    padding: ${space(2)} ${space(2)};
    `}

  ${p => p.addTopMargin && `margin-top: calc(${space(4)} + ${space(2)});`}

  & > *:first-of-type {
    margin-top: 0;
  }

  & > *:last-of-type {
    margin-bottom: 0;
  }

  /* Overwrite text color that was set in previewGlobalStyles.tsx */
  div,
  p,
  a,
  button {
    color: ${p => p.theme.textColor};
  }
`;

const ThemeSwitcher = styled('button')<{active: boolean}>`
  position: absolute;
  top: 0;
  right: ${space(0.5)};
  transform: translateY(calc(-100% - ${space(0.5)}));
  border: none;
  border-radius: ${p => p.theme.borderRadius};
  background: transparent;

  display: flex;
  align-items: center;
  padding: ${space(1)};
  margin-bottom: ${space(0.5)};
  color: ${p => p.theme.subText};

  &:hover {
    background: ${p => p.theme.innerBorder};
    color: ${p => p.theme.textColor};
  }

  ${p =>
    p.active &&
    `&, &:hover {
      color: ${p.theme.textColor};
    }
    `}
`;
