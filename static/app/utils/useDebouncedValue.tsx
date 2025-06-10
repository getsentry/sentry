import {useEffect, useRef, useState} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {DebounceSettings} from 'lodash';
import debounce from 'lodash/debounce';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

/**
 * Takes an input and returns a debounced version of that value.
 * NOTE: The value passed in should be a stable reference, only changing
 * when the value actually changes.
 */
export function useDebouncedValue<T>(
  value: T,
  delay: number = DEFAULT_DEBOUNCE_DURATION,
  options?: DebounceSettings
): {isDebouncing: boolean; value: T} {
  const [internalValue, setInternalValue] = useState(value);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceRef = useRef(
    debounce(
      (valueToSet: T) => {
        setInternalValue(valueToSet);
        setIsDebouncing(false);
      },
      delay,
      options
    )
  );

  const debounceFn = debounceRef.current;

  useEffectAfterFirstRender(() => {
    setIsDebouncing(true);
    debounceRef.current(value);
  }, [value]);

  useEffect(() => {
    return () => {
      debounceFn.cancel();
      setIsDebouncing(false);
    };
  }, [debounceFn]);

  return {isDebouncing, value: internalValue};
}
