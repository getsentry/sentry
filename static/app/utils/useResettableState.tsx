import {useCallback, useRef, useState} from 'react';

import {defined} from 'sentry/utils';

export function useResettableState<T>(defaultValue: () => T) {
  const defaultValueBoxed = useRef(defaultValue);
  defaultValueBoxed.current = defaultValue;

  const [state, _setState] = useState<T>(defaultValueBoxed.current());

  const setState = useCallback((newState: T | null | undefined) => {
    if (defined(newState)) {
      _setState(newState);
    } else if (newState === null) {
      _setState(defaultValueBoxed.current());
    }
  }, []);

  return [state, setState] as const;
}
