import {useWindowSize} from 'sentry/utils/window/useWindowSize';

export function useLogsQueryTruncate(): number {
  const {innerWidth} = useWindowSize();
  return Math.max(64, innerWidth / 16);
}
