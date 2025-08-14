import {useEffect, useState} from 'react';

export function useWindowHeight(): number {
  const [windowHeight, setWindowHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      setWindowHeight(window.innerHeight);
    });

    resizeObserver.observe(document.documentElement);

    const handleResize = (): void => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize, {passive: true});

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return windowHeight;
}
