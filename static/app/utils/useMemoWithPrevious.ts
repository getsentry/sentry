import React, {useState} from 'react';

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
  }, deps);

  return value;
};

export {useMemoWithPrevious};
