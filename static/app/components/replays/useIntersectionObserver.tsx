import {useCallback, useEffect, useRef} from 'react';

type Options = {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
};

function useIntersectionObserver({callback, options}: Options) {
  const observer = useRef<IntersectionObserver>();

  const cb = useCallback(callback, [callback]);

  useEffect(() => {
    observer.current = new IntersectionObserver(cb, options);
    return () => {
      observer.current?.disconnect();
    };
  }, [cb, options]);

  return {
    observe: target => observer.current?.observe(target),
  };
}

export default useIntersectionObserver;
