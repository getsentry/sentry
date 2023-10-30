import first from 'lodash/first';
import last from 'lodash/last';

import type {
  BreadcrumbFrame,
  NavigationFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import parseUrl from 'sentry/utils/url/parseUrl';
import stripOrigin from 'sentry/utils/url/stripOrigin';
import type {ReplayRecord} from 'sentry/views/replays/types';

function getCurrentUrl(
  replayRecord: undefined | ReplayRecord,
  frames: undefined | (BreadcrumbFrame | SpanFrame)[],
  currentOffsetMS: number
) {
  const framesBeforeCurrentOffset = frames?.filter(
    frame => frame.offsetMs < currentOffsetMS
  );

  const mostRecentFrame = last(framesBeforeCurrentOffset) ?? first(frames);
  if (!mostRecentFrame) {
    return '';
  }

  const initialUrl = replayRecord?.urls[0] ?? '';
  const origin = initialUrl ? parseUrl(initialUrl)?.origin || initialUrl : '';

  if ('category' in mostRecentFrame && mostRecentFrame.category === 'replay.init') {
    return origin + stripOrigin(mostRecentFrame.message ?? '');
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
    return origin + stripOrigin((mostRecentFrame as NavigationFrame).description);
  }

  throw new Error('Unknown frame type in getCurrentUrl');
}

export default getCurrentUrl;
