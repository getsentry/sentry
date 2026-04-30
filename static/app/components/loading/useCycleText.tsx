import {useEffect, useState} from 'react';

import {useTimeout} from 'sentry/utils/useTimeout';

interface Props {
  delayMs: number;
  messages: string[];
  disabled?: boolean;
}

export function useCycleText({messages, delayMs, disabled = false}: Props) {
  const [messageIndex, setMessageIndex] = useState(0);

  const {start, cancel} = useTimeout({
    timeMs: delayMs,
    onTimeout: () => {
      setMessageIndex(prev => Math.min(prev + 1, messages.length - 1));
      start();
    },
  });

  useEffect(() => {
    if (disabled) {
      cancel();
    } else {
      start();
    }
  }, [start, cancel, disabled]);

  return messages[messageIndex];
}
