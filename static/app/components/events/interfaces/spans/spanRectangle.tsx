import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {
  getDurationDisplay,
  getHumanDuration,
  toPercent,
} from 'sentry/components/performance/waterfall/utils';
import theme from 'sentry/utils/theme';

import {EnhancedSpan} from './types';
import {getSpanGroupTimestamps, SpanViewBoundsType} from './utils';

export default function SpanRectangle({
  spanGrouping,
  bounds,
  isOverlayRectangle,
}: {
  bounds: SpanViewBoundsType;
  spanGrouping: EnhancedSpan[];
  isOverlayRectangle?: boolean;
}) {
  if (isOverlayRectangle) {
    const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGrouping);
    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationDisplay = getDurationDisplay(bounds);
    const durationString = getHumanDuration(duration);

    return (
      <RowRectangle
        spanBarHatch={false}
        style={{
          left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
          width: toPercent(bounds.width || 0),
        }}
      >
        <DurationPill
          durationDisplay={durationDisplay}
          showDetail={false}
          spanBarHatch={false}
        >
          {durationString}
        </DurationPill>
      </RowRectangle>
    );
  }

  return (
    <RowRectangle
      spanBarHatch={false}
      style={{
        backgroundColor: theme.blue300,
        left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
        width: toPercent(bounds.width || 0),
      }}
    />
  );
}
