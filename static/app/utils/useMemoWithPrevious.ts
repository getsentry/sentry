import {useState} from 'react';

import {useEffectAfterFirstRender} from './useEffectAfterFirstRender';
import usePrevious from './usePrevious';

export function useMemoWithPrevious<T>({
  deps,
  factory,
}: {
  deps: React.DependencyList;
  factory: (previousInstance: T | null) => T;
}): T {
  const [value, setValue] = useState<T>(() => factory(null));
  const previous = usePrevious<T | null>(value);

  useEffectAfterFirstRender(() => {
    setValue(factory(previous));
    // Dependencies are explicitly managed and the deps warning is enabled for the custom hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
