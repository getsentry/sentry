import {useEffect, useState} from 'react';

interface WindowSize {
  innerHeight: number;
  innerWidth: number;
}

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  });

  useEffect(() => {
    let rafId: number | undefined;

    const handleResize = () => {
      if (rafId !== undefined) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        setWindowSize({innerWidth: window.innerWidth, innerHeight: window.innerHeight});
        rafId = undefined;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return windowSize;
}
