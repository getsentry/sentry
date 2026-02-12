import {useEffect, useState} from 'react';

const FIRST_MESSAGE_DELAY = 1500;
const MIN_SUBSEQUENT_DELAY = 3000;
const MAX_SUBSEQUENT_DELAY = 5000;
const ABSOLUTE_FALLBACK_TIMEOUT = 30_000;

/**
 * Rotates through an array of messages sequentially.
 *
 * - First message shows for 1500ms
 * - Subsequent messages show for a random 3000–5000ms
 * - Last message stays indefinitely once reached
 * - After 30s absolute timeout, force-jumps to the last message
 */
export function useRotatingMessage(messages: string[]): string {
  const [index, setIndex] = useState(0);
  const lastIndex = messages.length - 1;

  useEffect(() => {
    if (index >= lastIndex) {
      return undefined;
    }

    const delay =
      index === 0
        ? FIRST_MESSAGE_DELAY
        : MIN_SUBSEQUENT_DELAY +
          Math.random() * (MAX_SUBSEQUENT_DELAY - MIN_SUBSEQUENT_DELAY);

    const timer = setTimeout(() => {
      setIndex(prev => Math.min(prev + 1, lastIndex));
    }, delay);

    return () => clearTimeout(timer);
  }, [index, lastIndex]);

  // Absolute fallback: force-jump to last message after 30s
  useEffect(() => {
    const timer = setTimeout(() => {
      setIndex(lastIndex);
    }, ABSOLUTE_FALLBACK_TIMEOUT);

    return () => clearTimeout(timer);
  }, [lastIndex]);

  return messages[index]!;
}
