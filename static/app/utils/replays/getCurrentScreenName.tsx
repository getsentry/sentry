import type {BreadcrumbFrame} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

// Gets the current screen name for video/mobile replays - mirrors getCurrentUrl.tsx
function getCurrentScreenName(
  replayRecord: undefined | ReplayRecord,
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

  if ('category' in mostRecentFrame && mostRecentFrame.category === 'replay.init') {
    return replayRecord?.urls[0] ?? '';
  }

  return 'data' in mostRecentFrame && 'to' in mostRecentFrame.data
    ? mostRecentFrame.data.to
    : '';
}

export default getCurrentScreenName;
