import {RefObject, useEffect} from 'react';

interface UseIsVisible {
  /**
   * Callback function that is run when the DOM element referenced in `ref` is visible.
   */
  onIsVisible: () => void;
  /**
   * A React RefObject to the element to detect if visible.
   */
  ref: RefObject<HTMLElement>;
  /**
   * Function that is run when dependencies to the useEffect hook are changed.
   */
  cleanup?: () => void;
}

/**
 * Add an IntersectionObserver on `ref` to detect when element is visible.
 * If it's visible call `onIsVisible` callback. Runs `cleanup` when
 * dependencies change (ref, onIsVisible).
 */
export default function useIsVisible({ref, cleanup, onIsVisible}: UseIsVisible) {
  useEffect(() => {
    const observer = new IntersectionObserver(entities => {
      const [el] = entities;
      // The element (e.g. at bottom of a list) is visible, call callback
      if (el.isIntersecting) {
        onIsVisible();
      }
    });

    const currentElement = ref.current;

    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
      if (cleanup) {
        cleanup();
      }
    };
  }, [cleanup, onIsVisible, ref]);
}
