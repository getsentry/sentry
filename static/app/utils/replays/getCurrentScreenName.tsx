import type {BreadcrumbFrame} from 'sentry/utils/replays/types';

// Gets the current screen name for video/mobile replays - mirrors getCurrentUrl.tsx
function getCurrentScreenName(
  frames: undefined | BreadcrumbFrame[],
  currentOffsetMS: number
) {
  const framesBeforeCurrentOffset = frames?.filter(
    frame => frame.offsetMs < currentOffsetMS
  );

  const mostRecentFrame = framesBeforeCurrentOffset?.at(-1) ?? frames?.at(0);
  if (!mostRecentFrame) {
    return '';
  }

  return mostRecentFrame.data.to;
}

export default getCurrentScreenName;
