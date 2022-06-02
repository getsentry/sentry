import {useContext} from 'react';

import {FlamegraphTheme} from './flamegraphTheme';
import {FlamegraphThemeContext} from './flamegraphThemeProvider';

function useFlamegraphTheme(): FlamegraphTheme {
  const ctx = useContext(FlamegraphThemeContext);

  if (!ctx) {
    throw new Error('useFlamegraphTheme was called outside of FlamegraphThemeProvider');
  }

  return ctx;
}

export {useFlamegraphTheme};
