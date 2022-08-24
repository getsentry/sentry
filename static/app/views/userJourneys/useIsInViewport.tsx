import 'intersection-observer'; // this is a polyfill

import {useEffect, useMemo, useState} from 'react';

// Source: https://bobbyhadz.com/blog/react-check-if-element-in-viewport
function useIsInViewport(ref) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  const observer = useMemo(
    () => new IntersectionObserver(([entry]) => setIsIntersecting(entry.isIntersecting)),
    []
  );

  useEffect(() => {
    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, observer]);

  return isIntersecting;
}

export default useIsInViewport;
