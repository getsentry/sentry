import {useEffect, useState} from 'react';

/**
 * Hook that updates when a media query result changes
 */
export default function useMedia(query: string) {
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

  if (!window.matchMedia) {
    return false;
  }

  return state;
}
