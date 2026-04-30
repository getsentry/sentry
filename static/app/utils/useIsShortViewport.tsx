import {useMedia} from 'sentry/utils/useMedia';

export const SHORT_VIEWPORT_HEIGHT = 900;

export function useIsShortViewport(): boolean {
  return useMedia(`(max-height: ${SHORT_VIEWPORT_HEIGHT}px)`);
}
