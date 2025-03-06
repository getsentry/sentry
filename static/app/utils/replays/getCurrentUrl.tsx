import type {
  BreadcrumbFrame,
  NavigationFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import {safeURL} from 'sentry/utils/url/safeURL';
import stripURLOrigin from 'sentry/utils/url/stripURLOrigin';
import type {ReplayRecord} from 'sentry/views/replays/types';

function getCurrentUrl(
  replayRecord: undefined | ReplayRecord,
  frames: undefined | Array<BreadcrumbFrame | SpanFrame>,
  currentOffsetMS: number
) {
  const framesBeforeCurrentOffset = frames?.filter(
    frame => frame.offsetMs < currentOffsetMS
  );

  const mostRecentFrame = framesBeforeCurrentOffset?.at(-1) ?? frames?.at(0);
  if (!mostRecentFrame) {
    return '';
  }

  const initialUrl = replayRecord?.urls[0] ?? '';
  const origin = initialUrl ? safeURL(initialUrl)?.origin || initialUrl : '';

  if ('category' in mostRecentFrame && mostRecentFrame.category === 'replay.init') {
    return origin + stripURLOrigin(mostRecentFrame.message ?? '');
  }

  if (
    isSpanFrame(mostRecentFrame) &&
    [
      'navigation.navigate',
      'navigation.reload',
      'navigation.back_forward',
      'navigation.push',
    ].includes(mostRecentFrame.op)
  ) {
    // navigation.push will have the pathname while the other `navigate.*`
    // operations will have a full url.
    return origin + stripURLOrigin((mostRecentFrame as NavigationFrame).description);
  }

  throw new Error('Unknown frame type in getCurrentUrl');
}

export default getCurrentUrl;
