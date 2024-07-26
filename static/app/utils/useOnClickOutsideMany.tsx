import {useEffect} from 'react';

/**
 * Variation of useOnClickOutside to allow passing multiple refs.
 * Useful for making exemptions to behaviour outside click behaviour.
 */
function useOnClickOutsideMany(
  refs: React.RefObject<HTMLElement>[],
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (
        refs
          .map(r => r?.current) // refs -> elements | null
          .filter(el => el !== null) // elements | null -> elements
          .some(el => el.contains(event.target as Node)) // True if clicked element was within any elements
      ) {
        return;
      }

      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refs, handler]);
}

export default useOnClickOutsideMany;
