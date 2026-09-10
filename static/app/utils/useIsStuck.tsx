import {useEffect, useState} from 'react';

interface Options {
  offset?: number;
  position?: 'top' | 'bottom';
}

/**
 * Determine if a element with `position: sticky` is currently stuck.
 *
 * Accepts a ref object rather than `ref.current` so the element is read
 * inside the effect, after React has attached the ref during commit —
 * reading `ref.current` at render time would only ever see the value from
 * the previous render (`null` on mount) since attaching a ref doesn't
 * schedule a re-render.
 */
export function useIsStuck(
  ref: React.RefObject<HTMLElement | null>,
  options: Options = {}
) {
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
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
  }, [ref, options.position, options.offset]);

  return isStuck;
}
