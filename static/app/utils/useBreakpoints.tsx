import {useEffect, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

export function useInstantRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

type Breakpoint = keyof Theme['breakpoints'];
export function checkBreakpoints(
  breakpoints: Record<Breakpoint, string>,
  width: number
): Record<Breakpoint, boolean> {
  return Object.entries(breakpoints).reduce(
    (acc, [key, value]) => {
      // Assuming breakpoints are pixel values
      acc[key as Breakpoint] = width >= parseInt(value, 10);
      return acc;
    },
    {} as Record<Breakpoint, boolean>
  );
}

/**
 * Returns the currently active breakpoints
 */
export function useBreakpoints(): Record<Breakpoint, boolean> {
  const theme = useTheme();
  const [value, setValue] = useState(
    checkBreakpoints(theme.breakpoints, window.innerWidth)
  );
  const valueRef = useInstantRef(value);

  useEffect(() => {
    const handleResize = debounce(() => {
      const newValue = checkBreakpoints(theme.breakpoints, window.innerWidth);
      if (!isEqual(newValue, valueRef.current)) {
        setValue(newValue);
      }
    }, 100);

    window.addEventListener('resize', handleResize, {passive: true});
    return () => {
      window.removeEventListener('resize', handleResize);
      handleResize.cancel();
    };
  }, [theme.breakpoints, valueRef]);

  return value;
}
