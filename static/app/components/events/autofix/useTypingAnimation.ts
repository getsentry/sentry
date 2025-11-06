import {useEffect, useRef, useState} from 'react';

interface UseTypingAnimationProps {
  /**
   * The full text to animate.
   */
  text: string;
  /**
   * Whether the animation should run. If false, displays the full text immediately. Defaults to true.
   */
  enabled?: boolean;
  /**
   * Callback fired when the animation completes.
   */
  onComplete?: () => void;
  /**
   * Animation speed in characters per second. Defaults to 50.
   */
  speed?: number;
}

/**
 * Animates the display of text as if it were being typed.
 */
export function useTypingAnimation({
  text,
  speed = 50,
  enabled = true,
  onComplete,
}: UseTypingAnimationProps): string {
  const [displayedText, setDisplayedText] = useState(enabled ? '' : text);
  const currentIndexRef = useRef(enabled ? 0 : text.length);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);

  // Keep the onComplete callback reference up-to-date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // If disabled, show full text immediately
    if (!enabled) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDisplayedText(text);
      currentIndexRef.current = text.length;
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return () => {};
    }

    // Reset state for new animation
    setDisplayedText('');
    currentIndexRef.current = 0;
    lastUpdateTimeRef.current = performance.now();

    const interval = 1000 / speed; // ms per character

    const animate = (timestamp: number) => {
      if (!enabled) return; // Check enabled status

      const elapsed = timestamp - lastUpdateTimeRef.current;
      const charsToAdd = Math.floor(elapsed / interval);

      if (charsToAdd > 0) {
        const nextIndex = Math.min(text.length, currentIndexRef.current + charsToAdd);
        if (nextIndex > currentIndexRef.current) {
          setDisplayedText(_prev => text.slice(0, nextIndex)); // Use functional update, ignore prev
          currentIndexRef.current = nextIndex;
          lastUpdateTimeRef.current = timestamp;
        }
      }

      if (currentIndexRef.current < text.length) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        // Final check to ensure full text is displayed
        setDisplayedText(currentDisplayedText => {
          if (currentDisplayedText !== text) {
            return text;
          }
          return currentDisplayedText;
        });
        animationFrameRef.current = null;
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    };

    // Clear previous frame before starting
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = window.requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [text, speed, enabled]); // Dependencies are correct now

  // Effect to immediately set full text if enabled becomes false
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDisplayedText(text);
      currentIndexRef.current = text.length;
    }
  }, [enabled, text]);

  return displayedText;
}
