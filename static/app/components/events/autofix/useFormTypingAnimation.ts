import {useCallback, useEffect, useRef} from 'react';

import type FormModel from 'sentry/components/forms/model';

interface TriggerFormTypingAnimationParams {
  fieldName: string;
  formModel: FormModel;
  text: string;
  quiet?: boolean;
  speed?: number;
}

interface UseFormTypingAnimationOptions {
  /**
   * Whether to update the form field quietly (skip field callbacks/validation).
   */
  quiet?: boolean;
  /**
   * Typing speed in characters per second.
   */
  speed?: number;
}

/**
 * Animates text directly into a form field value.
 */
export function useFormTypingAnimation({
  speed: defaultSpeed = 50,
  quiet: defaultQuiet = true,
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
    ({
      formModel,
      fieldName,
      text,
      speed = defaultSpeed,
      quiet = defaultQuiet,
    }: TriggerFormTypingAnimationParams) => {
      cancelFormTypingAnimation();

      const runId = runIdRef.current;

      if (!text.length) {
        formModel.setValue(fieldName, '', {quiet});
        return;
      }

      currentIndexRef.current = 0;
      lastUpdateTimeRef.current = performance.now();
      formModel.setValue(fieldName, '', {quiet});

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
            formModel.setValue(fieldName, text.slice(0, nextIndex), {quiet});
            currentIndexRef.current = nextIndex;
            lastUpdateTimeRef.current = timestamp;
          }
        }

        if (currentIndexRef.current < text.length) {
          animationFrameRef.current = window.requestAnimationFrame(animate);
          return;
        }

        animationFrameRef.current = null;
        formModel.setValue(fieldName, text);
      };

      animationFrameRef.current = window.requestAnimationFrame(animate);
    },
    [cancelFormTypingAnimation, defaultQuiet, defaultSpeed]
  );

  return {triggerFormTypingAnimation, cancelFormTypingAnimation};
}
