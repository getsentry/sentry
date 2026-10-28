import {useEffect, useState, type RefObject} from 'react';
import {useReducedMotion} from 'framer-motion';

/** Defers artwork loading and pauses playback while its surface is hidden. */
export function useArtworkActivity(surface: RefObject<Element | null>) {
  const [visibility, setVisibility] = useState<'unseen' | 'visible' | 'hidden'>('unseen');
  const reducedMotion = Boolean(useReducedMotion());
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

  useEffect(() => {
    const element = surface.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setVisibility(previous =>
        entry?.isIntersecting ? 'visible' : previous === 'unseen' ? 'unseen' : 'hidden'
      );
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [surface]);

  useEffect(() => {
    const onVisibilityChange = () => setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange();

    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return {
    hasBeenVisible: visibility !== 'unseen',
    isActive: visibility === 'visible' && isPageVisible && !reducedMotion,
    reducedMotion,
  };
}
