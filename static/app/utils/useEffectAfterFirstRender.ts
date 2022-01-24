import {useEffect, useRef} from 'react';

const NOOP: [] = [];

const useEffectAfterFirstRender = (
  cb: React.EffectCallback,
  deps: React.DependencyList = NOOP
): void => {
  const firstRender = useRef<boolean>(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    cb();
  }, deps);
};

export {useEffectAfterFirstRender};
