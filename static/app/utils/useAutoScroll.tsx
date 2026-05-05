import {useCallback, useEffect, useRef, useState, type UIEventHandler} from 'react';

import {defined} from 'sentry/utils';

interface UseAutoScrollOptions {
  key: unknown;
}

export function useAutoScroll({key}: UseAutoScrollOptions) {
  const [canAutoScroll, setCanAutoScroll] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!canAutoScroll || !defined(container)) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [canAutoScroll, key]);

  const onScrollHandler: UIEventHandler = useCallback(event => {
    const {scrollTop, scrollHeight, clientHeight} = event.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 1;
    setCanAutoScroll(atBottom);
  }, []);

  return {
    containerRef,
    onScrollHandler,
  };
}
