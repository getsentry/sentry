import {useEffect, useRef} from 'react';

const useEffectAfterFirstRender = (
  cb: React.EffectCallback,
  deps: React.DependencyList
): void => {
  const firstRender = useRef<boolean>(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    cb();
    // Dependencies are explicitly managed and the deps warning is enabled for the custom hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export {useEffectAfterFirstRender};
