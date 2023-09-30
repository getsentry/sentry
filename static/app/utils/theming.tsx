import {createTheming} from '@callstack/react-theme-provider';

import {lightTheme} from 'sentry/utils/theme';

const {ThemeProvider, withTheme, useTheme} = createTheming(lightTheme);

export {ThemeProvider, withTheme, useTheme};
