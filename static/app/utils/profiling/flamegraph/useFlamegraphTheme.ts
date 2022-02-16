import * as React from 'react';

import {FlamegraphTheme} from './FlamegraphTheme';
import {FlamegraphThemeContext} from './FlamegraphThemeProvider';

function useFlamegraphTheme(): FlamegraphTheme {
  const ctx = React.useContext(FlamegraphThemeContext);

  if (!ctx) {
    throw new Error('useFlamegraphTheme was called outside of FlamegraphThemeProvider');
  }

  return ctx;
}

export {useFlamegraphTheme};
