import {useEffect, useState, type RefObject} from 'react';
import {useReducedMotion} from 'framer-motion';

/**
 * Some environments (privacy hardening, embedded browsers) don't expose
 * IntersectionObserver. Without it we can't tell when the artwork is on
 * screen, so treat it as visible rather than crashing the surrounding page.
 */
function supportsIntersectionObserver(): boolean {
  return 'IntersectionObserver' in window;
}

/** Defers artwork loading and pauses playback while its surface is hidden. */
export function useArtworkActivity(surface: RefObject<Element | null>) {
  const [visibility, setVisibility] = useState<'unseen' | 'visible' | 'hidden'>(() =>
    supportsIntersectionObserver() ? 'unseen' : 'visible'
  );
  const reducedMotion = Boolean(useReducedMotion());
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

  useEffect(() => {
    const element = surface.current;

    if (!element || !supportsIntersectionObserver()) {
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
