import {useContext} from 'react';

import {FlamegraphTheme} from './flamegraphTheme';
import {
  FlamegraphThemeContext,
  FlamegraphThemeMutationContext,
} from './flamegraphThemeProvider';

export function useFlamegraphTheme(): FlamegraphTheme {
  const ctx = useContext(FlamegraphThemeContext);

  if (!ctx) {
    throw new Error('useFlamegraphTheme was called outside of FlamegraphThemeProvider');
  }

  return ctx;
}

export function useMutateFlamegraphTheme() {
  const ctx = useContext(FlamegraphThemeMutationContext);
  if (!ctx) {
    throw new Error(
      'useMutateFlamegraphTheme was called outside of FlamegraphThemeProvider'
    );
  }
  return ctx;
}
