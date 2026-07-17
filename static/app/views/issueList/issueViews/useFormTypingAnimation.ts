import {useCallback, useEffect, useRef} from 'react';

interface TriggerFormTypingAnimationParams {
  /**
   * Called with the incremental (and finally the full) text as the animation runs.
   */
  setValue: (value: string) => void;
  text: string;
  speed?: number;
}

interface UseFormTypingAnimationOptions {
  /**
   * Typing speed in characters per second.
   */
  speed?: number;
}

/**
 * Animates text into a form field by repeatedly calling `setValue` with a
 * growing slice of the text. The consumer decides how to apply the value.
 */
export function useFormTypingAnimation({
  speed: defaultSpeed = 70,
}: UseFormTypingAnimationOptions = {}) {
  const animationFrameRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);
  const runIdRef = useRef(0);

  const cancelFormTypingAnimation = useCallback(() => {
    runIdRef.current += 1;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => cancelFormTypingAnimation, [cancelFormTypingAnimation]);

  const triggerFormTypingAnimation = useCallback(
    ({setValue, text, speed = defaultSpeed}: TriggerFormTypingAnimationParams) => {
      cancelFormTypingAnimation();

      const runId = runIdRef.current;

      if (!text.length) {
        setValue('');
        return;
      }

      currentIndexRef.current = 0;
      lastUpdateTimeRef.current = performance.now();
      setValue('');

      const interval = 1000 / Math.max(1, speed);

      const animate = (timestamp: number) => {
        if (runIdRef.current !== runId) {
          return;
        }

        const elapsed = timestamp - lastUpdateTimeRef.current;
        const charsToAdd = Math.floor(elapsed / interval);

        if (charsToAdd > 0) {
          const nextIndex = Math.min(text.length, currentIndexRef.current + charsToAdd);
          if (nextIndex > currentIndexRef.current) {
            setValue(text.slice(0, nextIndex));
            currentIndexRef.current = nextIndex;
            lastUpdateTimeRef.current = timestamp;
          }
        }

        if (currentIndexRef.current < text.length) {
          animationFrameRef.current = window.requestAnimationFrame(animate);
          return;
        }

        animationFrameRef.current = null;
        setValue(text);
      };

      animationFrameRef.current = window.requestAnimationFrame(animate);
    },
    [cancelFormTypingAnimation, defaultSpeed]
  );

  return {triggerFormTypingAnimation, cancelFormTypingAnimation};
}
