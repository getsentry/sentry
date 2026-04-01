import {useEffect, useState} from 'react';

import {useTimeout} from 'sentry/utils/useTimeout';

interface Props {
  delayMs: number;
  messages: string[];
  enabled?: boolean;
}

export function useCycleText({messages, delayMs, enabled}: Props) {
  const [messageIndex, setMessageIndex] = useState(0);

  const {start} = useTimeout({
    timeMs: delayMs,
    onTimeout: () => {
      setMessageIndex(prev => prev + 1);
      start();
    },
  });

  useEffect(() => {
    if (enabled ?? true) {
      start();
    }
  }, [start, enabled]);

  return messages[messageIndex];
}
