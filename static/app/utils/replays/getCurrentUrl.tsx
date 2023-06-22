import first from 'lodash/first';
import last from 'lodash/last';

import type {
  BreadcrumbFrame,
  HistoryFrame,
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

  if ('op' in mostRecentFrame) {
    if (
      ['navigation.navigate', 'navigation.reload', 'navigation.back_forward'].includes(
        mostRecentFrame.op
      )
    ) {
      // TODO(replay): `to` is not part of the type, but should it be?
      // @ts-expect-error
      return stripOrigin((mostRecentFrame as NavigationFrame).data.to);
    }
    if (mostRecentFrame.op === 'navigation.push') {
      return stripOrigin((mostRecentFrame as HistoryFrame).data.previous);
    }
  }

  throw new Error('Unknown frame type in getCurrentUrl');
}

export default getCurrentUrl;
