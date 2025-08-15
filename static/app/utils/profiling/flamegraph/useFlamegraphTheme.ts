import {useContext} from 'react';

import type {FlamegraphTheme} from './flamegraphTheme';
import {FlamegraphThemeContext} from './flamegraphThemeProvider';

export function useFlamegraphTheme(): FlamegraphTheme {
  const ctx = useContext(FlamegraphThemeContext);

  if (!ctx) {
    throw new Error('useFlamegraphTheme was called outside of FlamegraphThemeProvider');
  }

  return ctx;
}
