import {useState} from 'react';

import {useEffectAfterFirstRender} from './useEffectAfterFirstRender';
import usePrevious from './usePrevious';

const useMemoWithPrevious = <T>(
  factory: (previousInstance: T | null) => T,
  deps: React.DependencyList
): T => {
  const [value, setValue] = useState<T>(() => factory(null));
  const previous = usePrevious<T | null>(value);

  useEffectAfterFirstRender(() => {
    setValue(factory(previous));
    // Dependencies are explicitly managed and the deps warning is enabled for the custom hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
};

export {useMemoWithPrevious};
