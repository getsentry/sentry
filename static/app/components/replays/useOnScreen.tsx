import {RefObject, useEffect, useRef, useState} from 'react';

export default function useOnScreen(target: RefObject<HTMLElement>) {
  const observerRef = useRef<IntersectionObserver>(
    new IntersectionObserver(([entry]) => setIsOnScreen(entry.isIntersecting))
  );
  const [isOnScreen, setIsOnScreen] = useState(false);

  useEffect(() => {
    const observer = observerRef.current;
    if (target.current) {
      observer.observe(target.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [target]);

  return isOnScreen;
}
