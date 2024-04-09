import {useCallback, useState} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {DebouncedFunc} from 'lodash';
import debounce from 'lodash/debounce';

// NOTE: This can be extracted for more general use if:
// 1. It gets some thorough tests
// 2. It correctly cancels debounces
export function useDebouncedState<T>(
  initialValue: T,
  deps: React.DependencyList,
  delay: number = DEFAULT_DEBOUNCE
): [T, DebouncedFunc<React.Dispatch<React.SetStateAction<T>>>] {
  const [value, setValue] = useState<T>(initialValue);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetValue = useCallback(debounce(setValue, delay), deps);

  return [value, debouncedSetValue];
}

const DEFAULT_DEBOUNCE = 100;
