import {useCallback, useMemo, useState} from 'react';

export interface Dimensions {
  height: number;
  width: number;
}

/**
 * Measures an element. Attach the returned `ref` to it: the element is measured
 * when it mounts, before the browser paints, and again whenever it resizes.
 * The size is 0 until an element is attached.
 */
export function useDimensions() {
  const [dimensions, setDimensions] = useState<Dimensions>(() => ({height: 0, width: 0}));

  const ref = useCallback((element: Element | null) => {
    if (!element) {
      return;
    }

    const measure = () => {
      const {clientHeight: height, clientWidth: width} = element;
      setDimensions(prev =>
        prev.height === height && prev.width === width ? prev : {height, width}
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return useMemo(() => ({ref, ...dimensions}), [ref, dimensions]);
}
