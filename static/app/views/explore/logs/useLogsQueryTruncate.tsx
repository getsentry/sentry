import {useRef} from 'react';

import {useWindowSize} from 'sentry/utils/window/useWindowSize';

export function useLogsQueryTruncate(): number {
  const {innerWidth} = useWindowSize();
  const target = Math.max(128, Math.floor(innerWidth / 16));

  // Round up to the next power of two so small viewport changes don't shift the
  // truncation length and trigger a re-query.
  const truncate = 2 ** Math.ceil(Math.log2(target));

  // Only ever grow the truncation length. Shrinking the viewport means the
  // logs we already fetched are still long enough to display, so there is no
  // reason to re-query for shorter messages.
  const maxTruncate = useRef(truncate);
  maxTruncate.current = Math.max(maxTruncate.current, truncate);

  return maxTruncate.current;
}
