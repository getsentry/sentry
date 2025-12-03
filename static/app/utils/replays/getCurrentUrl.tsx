import type {
  BreadcrumbFrame,
  NavigationFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import {safeURL} from 'sentry/utils/url/safeURL';
import stripURLOrigin from 'sentry/utils/url/stripURLOrigin';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function getCurrentUrl(
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

  return frameToUrl(origin, mostRecentFrame).url;
}

function frameToUrl(origin: string, frame: BreadcrumbFrame | SpanFrame) {
  if ('category' in frame && frame.category === 'replay.init') {
    const path = stripURLOrigin(frame.message ?? '');
    return {
      frame,
      url: origin + path,
      path,
    };
  }

  if (
    isSpanFrame(frame) &&
    [
      'navigation.navigate',
      'navigation.reload',
      'navigation.back_forward',
      'navigation.push',
    ].includes(frame.op)
  ) {
    // navigation.push will have the pathname while the other `navigate.*`
    // operations will have a full url.
    const path = stripURLOrigin((frame as NavigationFrame).description);
    return {
      frame,
      url: origin + path,
      path,
    };
  }

  throw new Error('Unknown frame type in getCurrentUrl');
}
