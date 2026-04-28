import {useEffect, useState} from 'react';

const MIN_DELAY = 3000;
const MAX_DELAY = 5000;

/**
 * Rotates through messages in random order indefinitely.
 *
 * - Messages show for a random 3000–5000ms
 * - Each new message is randomly picked, avoiding the current one
 */
export function useRotatingMessage(messages: string[]): string {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * messages.length));

  useEffect(() => {
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

    const timer = setTimeout(() => {
      setIndex(prev => {
        const offset = 1 + Math.floor(Math.random() * (messages.length - 1));
        return (prev + offset) % messages.length;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [index, messages.length]);

  return messages[index]!;
}
