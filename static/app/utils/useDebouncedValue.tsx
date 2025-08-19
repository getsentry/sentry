import {useEffect, useRef, useState} from 'react';
import {debounce} from 'es-toolkit/compat';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

type DebounceSettings = Parameters<typeof debounce>[2];

/**
 * Takes an input and returns a debounced version of that value.
 * NOTE: The value passed in should be a stable reference, only changing
 * when the value actually changes.
 */
export function useDebouncedValue<T>(
  value: T,
  delay: number = DEFAULT_DEBOUNCE_DURATION,
  options?: DebounceSettings
): T {
  const [internalValue, setInternalValue] = useState(value);

  const debounceRef = useRef(
    debounce((valueToSet: T) => setInternalValue(valueToSet), delay, options)
  );

  const debounceFn = debounceRef.current;

  useEffectAfterFirstRender(() => {
    debounceRef.current(value);
  }, [value]);

  useEffect(() => {
    return () => {
      debounceFn.cancel();
    };
  }, [debounceFn]);

  return internalValue;
}
