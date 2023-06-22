import first from 'lodash/first';
import last from 'lodash/last';

import type {
  BreadcrumbFrame,
  NavigationFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';
import stripOrigin from 'sentry/utils/url/stripOrigin';

function getCurrentUrl(
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

  if ('category' in mostRecentFrame && mostRecentFrame.category === 'replay.init') {
    return stripOrigin(mostRecentFrame.message ?? '');
  }

  if (
    'op' in mostRecentFrame &&
    [
      'navigation.navigate',
      'navigation.reload',
      'navigation.back_forward',
      'navigation.push',
    ].includes(mostRecentFrame.op)
  ) {
    // `navigation.push` will probably have just the pathname
    // while the other `navigate.*`  operations will have a full url
    return stripOrigin((mostRecentFrame as NavigationFrame).description);
  }

  throw new Error('Unknown frame type in getCurrentUrl');
}

export default getCurrentUrl;
