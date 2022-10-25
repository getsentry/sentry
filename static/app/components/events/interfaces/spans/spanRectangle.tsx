import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {toPercent} from 'sentry/components/performance/waterfall/utils';
import theme from 'sentry/utils/theme';

import {EnhancedSpan} from './types';
import {SpanViewBoundsType} from './utils';

export default function SpanRectangle({
  bounds,
}: {
  bounds: SpanViewBoundsType;
  spanGrouping: EnhancedSpan[];
}) {
  return (
    <RowRectangle
      style={{
        backgroundColor: theme.blue300,
        left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
        width: toPercent(bounds.width || 0),
      }}
    />
  );
}
