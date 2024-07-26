import {useEffect} from 'react';

/**
 * Variation of useOnClickOutside to allow passing multiple refs
 */
function useOnClickOutsideMany(
  refs: React.RefObject<HTMLElement>[],
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(
    () => {
      const listener = (event: MouseEvent | TouchEvent) => {
        if (!refs) {
          return;
        }
        let elements: (HTMLElement | null)[] = [];
        elements = refs.map(r => r?.current);

        // Do nothing if clicking any refs' element or their descendent elements
        if (
          elements.filter(el => el !== null).some(el => el.contains(event.target as Node))
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
    },
    // Reload only if ref or handler changes
    [refs, handler]
  );
}

export default useOnClickOutsideMany;
