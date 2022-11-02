import {useEffect, useState} from 'react';

/**
 * Hook that updates when a media query result changes
 */
export default function useMedia(query: string) {
  const [state, setState] = useState(
    () => window.matchMedia && window.matchMedia(query)?.matches
  );

  useEffect(() => {
    let mounted = true;
    if (!window.matchMedia) {
      return undefined;
    }

    const mql = window.matchMedia(query);
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

  if (!window.matchMedia) {
    return false;
  }

  return state;
}
