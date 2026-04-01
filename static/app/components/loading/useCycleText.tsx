import {useEffect, useState} from 'react';

import {useTimeout} from 'sentry/utils/useTimeout';

interface Props {
  delayMs: number;
  messages: string[];
  enabled?: boolean;
}

export function useCycleText({messages, delayMs, enabled}: Props) {
  const [messageIndex, setMessageIndex] = useState(0);

  const {start, cancel} = useTimeout({
    timeMs: delayMs,
    onTimeout: () => {
      setMessageIndex(prev => Math.min(prev + 1, messages.length - 1));
      start();
    },
  });

  useEffect(() => {
    if (enabled ?? true) {
      start();
    } else {
      cancel();
    }
  }, [start, cancel, enabled]);

  return messages[messageIndex];
}
