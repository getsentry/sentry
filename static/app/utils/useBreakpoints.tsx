import {useEffect, useEffectEvent, useState} from 'react';
import {useTheme} from '@emotion/react';
import {Debouncer} from '@tanstack/react-pacer';

import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';
import type {BreakpointSize} from 'sentry/utils/theme';

export type Breakpoints = Record<BreakpointSize, string>;

export function checkBreakpoints(breakpoints: Breakpoints, width: number) {
  return Object.fromEntries(
    Object.entries(breakpoints).map(([key, value]) => [key, width >= parseInt(value, 10)])
  ) as Record<BreakpointSize, boolean>;
}

/**
 * Returns the currently active breakpoints
 */
export function useBreakpoints(): Record<BreakpointSize, boolean> {
  const theme = useTheme();
  const [value, setValue] = useState(() =>
    checkBreakpoints(theme.breakpoints, window.innerWidth)
  );
  const updateBreakpoints = useEffectEvent(() => {
    const nextValue = checkBreakpoints(theme.breakpoints, window.innerWidth);
    if (!valueIsEqual(value, nextValue)) {
      setValue(nextValue);
    }
  });

  useEffect(() => {
    const debouncer = new Debouncer(() => updateBreakpoints(), {wait: 100});
    const handleResize = debouncer.maybeExecute;

    window.addEventListener('resize', handleResize, {passive: true});
    return () => {
      window.removeEventListener('resize', handleResize);
      debouncer.cancel();
    };
  }, []);

  return value;
}
