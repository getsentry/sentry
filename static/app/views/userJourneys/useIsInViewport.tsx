import 'intersection-observer'; // this is a polyfill

import {useEffect, useMemo, useState} from 'react';

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
