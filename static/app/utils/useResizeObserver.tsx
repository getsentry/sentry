import {RefObject, useEffect} from 'react';

function hasResizeObserver() {
  return typeof window.ResizeObserver === 'function';
}

interface UseResizeObserverOptionsType<T> {
  onResize: (entries: ResizeObserverEntry[]) => void;
  ref: RefObject<T | undefined> | undefined;
  isDisabled?: boolean;
}

export function useResizeObserver<T extends Element>({
  ref,
  onResize,
  isDisabled,
}: UseResizeObserverOptionsType<T>) {
  useEffect(() => {
    const element = ref?.current;
    if (!element || isDisabled || !hasResizeObserver()) {
      return () => {};
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      if (!entries.length) {
        return;
      }

      onResize(entries);
    });
    resizeObserver.observe(element);

    return () => {
      if (element) {
        resizeObserver.unobserve(element);
      }
    };
  }, [onResize, ref, isDisabled]);
}
