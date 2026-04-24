import {useEffect, useState} from 'react';

interface Options {
  offset?: number;
  position?: 'top' | 'bottom';
}

/**
 * Determine if a element with `position: sticky` is currently stuck.
 */
export function useIsStuck(el: HTMLElement | null, options: Options = {}) {
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    if (el === null) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(entry!.intersectionRatio < 1),
      {
        rootMargin:
          options.position === 'bottom'
            ? `0px 0px ${-(options.offset ?? 0) - 1}px 0px`
            : `${-(options.offset ?? 0) - 1}px 0px 0px 0px`,
        threshold: [1],
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [el, options.position, options.offset]);

  return isStuck;
}
