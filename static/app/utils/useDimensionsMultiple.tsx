import {useLayoutEffect, useRef, useState} from 'react';

interface Props<Element extends HTMLElement> {
  elements: Array<Element | null>;
}

/**
 * Measures the dimensions of multiple elements at once.
 */
export function useDimensionsMultiple<Element extends HTMLElement>({
  elements,
}: Props<Element>) {
  const [dimensions, setDimensions] = useState<DOMRectReadOnly[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useLayoutEffect(() => {
    resizeObserverRef.current = new ResizeObserver(entries => {
      setDimensions(prevDimensions => {
        const newDimensions = [...prevDimensions];

        for (const entry of entries) {
          const index = elements.indexOf(entry.target as Element);
          if (index === -1) {
            continue;
          }
          newDimensions[index] = entry.contentRect;
        }

        return newDimensions;
      });
    });

    elements.forEach(element => {
      if (element && resizeObserverRef.current) {
        resizeObserverRef.current.observe(element);
      }
    });

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [elements]);

  return dimensions;
}
