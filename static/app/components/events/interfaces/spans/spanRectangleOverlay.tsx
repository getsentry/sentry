import {SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {
  getDurationDisplay,
  getHumanDuration,
} from 'sentry/components/performance/waterfall/utils';
import toPercent from 'sentry/utils/number/toPercent';

import {EnhancedSpan} from './types';
import {getSpanGroupTimestamps, SpanViewBoundsType} from './utils';

export function SpanRectangleOverlay({
  bounds,
  spanGrouping,
  spanBarType,
}: {
  bounds: SpanViewBoundsType;
  spanGrouping: EnhancedSpan[];
  spanBarType?: SpanBarType;
}) {
  const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGrouping);
  const duration = Math.abs(endTimestamp - startTimestamp);
  const durationDisplay = getDurationDisplay(bounds);
  const durationString = getHumanDuration(duration);

  return (
    <RowRectangle
      style={{
        left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
        width: toPercent(bounds.width || 0),
      }}
    >
      <DurationPill
        durationDisplay={durationDisplay}
        showDetail={false}
        spanBarType={spanBarType}
      >
        {durationString}
      </DurationPill>
    </RowRectangle>
  );
}
