import {useEffect, useState} from 'react';

/**
 * Hook that updates when a media query result changes.
 *
 * Prefer this only for genuine media features that aren't container-expressible
 * — e.g. `(prefers-color-scheme: ...)`, `(hover: ...)`, `(pointer: ...)`,
 * `(max-height: ...)`, `(resolution: ...)`.
 *
 * For width-based checks, prefer scraps responsive props — bare breakpoint
 * keys react to the nearest container (`<Flex direction={{xs: 'column'}} />`),
 * `screen:`-prefixed keys to the viewport — or, when you need the resolved
 * value in JS, `useContainerBreakpoint()` from `@sentry/scraps/layout`.
 * Those react to an element's available space rather than the raw viewport,
 * which is almost always what width checks actually want.
 */
export function useMedia(query: string) {
  const [state, setState] = useState(() => window.matchMedia?.(query)?.matches);

  useEffect(() => {
    let mounted = true;
    if (!window.matchMedia) {
      return;
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
