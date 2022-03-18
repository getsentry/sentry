import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {
  getDurationDisplay,
  getHumanDuration,
  toPercent,
} from 'sentry/components/performance/waterfall/utils';
import theme from 'sentry/utils/theme';

import {EnhancedSpan} from './types';
import {
  getSpanGroupBounds,
  getSpanGroupTimestamps,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';

export default function SpanRectangle({
  spanGrouping,
  index,
  generateBounds,
}: {
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  index: number;
  spanGrouping: EnhancedSpan[];
}) {
  // If an index is provided, we treat this as an individual block for a single span in the grouping
  if (index !== undefined) {
    const grouping = [spanGrouping[index]];
    const bounds = getSpanGroupBounds(grouping, generateBounds);

    // If this is not the last span in the grouping, the duration does not need to be rendered
    if (index !== spanGrouping.length - 1) {
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

    const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGrouping);
    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationDisplay = getDurationDisplay(bounds);
    const durationString = getHumanDuration(duration);

    return (
      <RowRectangle
        spanBarHatch={false}
        style={{
          backgroundColor: theme.blue300,
          left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
          width: toPercent(bounds.width || 0),
        }}
      >
        {index === spanGrouping.length - 1 && (
          <DurationPill
            durationDisplay={durationDisplay}
            showDetail={false}
            spanBarHatch={false}
          >
            {durationString}
          </DurationPill>
        )}
      </RowRectangle>
    );
  }
  const bounds = getSpanGroupBounds(spanGrouping, generateBounds);
  const durationDisplay = getDurationDisplay(bounds);
  const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGrouping);
  const duration = Math.abs(endTimestamp - startTimestamp);
  const durationString = getHumanDuration(duration);
  return (
    <RowRectangle
      spanBarHatch={false}
      style={{
        backgroundColor: theme.blue300,
        left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
        width: toPercent(bounds.width || 0),
      }}
    >
      {
        <DurationPill
          durationDisplay={durationDisplay}
          showDetail={false}
          spanBarHatch={false}
        >
          {durationString}
        </DurationPill>
      }
    </RowRectangle>
  );
}
