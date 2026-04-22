import {useEffect, useState} from 'react';

/**
 * Hook that updates when a media query result changes
 */
export function useMedia(query: string) {
  const [state, setState] = useState(() => globalThis.matchMedia?.(query)?.matches);

  useEffect(() => {
    let mounted = true;
    if (!globalThis.matchMedia) {
      return undefined;
    }

    const mql = globalThis.matchMedia(query);
    const onChange = () => {
      if (!mounted) {
        return;
      }
      setState(!!mql.matches);
    };

    mql.addEventListener('change', onChange);
    setState(mql.matches);

    return () => {
      mounted = false;
      mql.removeEventListener('change', onChange);
    };
  }, [query]);

  if (!globalThis.matchMedia) {
    return false;
  }

  return state;
}
