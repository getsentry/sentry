import {useEffect, useState} from 'react';

interface Options {
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
        rootMargin: options.position === 'top' ? '-1px 0px 0px 0px' : '0px 0px -1px 0px',
        threshold: [1],
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [el, options.position]);

  return isStuck;
}
