import {useEffect, useRef} from 'react';
/**
 * Provides a boolean indicating if the component has completed its initial mount.
 * @returns true if the component has mounted, false otherwise.
 */
export function useHasMounted() {
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  return hasMounted.current;
}
