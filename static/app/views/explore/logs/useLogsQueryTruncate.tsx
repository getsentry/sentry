import {useWindowSize} from 'sentry/utils/window/useWindowSize';

export function useLogsQueryTruncate(): number {
  const {innerWidth} = useWindowSize();
  return Math.max(256, innerWidth / 16);
}
