import 'intersection-observer'; // polyfill

import {useEffect, useState} from 'react';

/**
 * Determine if a element with `position: sticky` is currently stuck.
 */
export function useIsStuck(el: HTMLElement | null) {
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    if (el === null) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(entry.intersectionRatio < 1),
      {
        rootMargin: '-1px 0px 0px 0px',
        threshold: [1],
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [el]);

  return isStuck;
}
