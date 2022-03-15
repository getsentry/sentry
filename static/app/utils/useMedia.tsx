import {useEffect, useState} from 'react';

/**
 * Hook that updates when a media query result changes
 */
export default function useMedia(query: string): boolean {
  if (!window.matchMedia) {
    return false;
  }

  const [state, setState] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    let mounted = true;
    const mql = window.matchMedia(query);
    const onChange = () => {
      if (!mounted) {
        return;
      }
      setState(!!mql.matches);
    };

    mql.addListener(onChange);
    setState(mql.matches);

    return () => {
      mounted = false;
      mql.removeListener(onChange);
    };
  }, [query]);

  return state;
}
