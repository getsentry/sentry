import {useTheme} from '@emotion/react';

import {
  getSpanBarColours,
  SpanBarType,
} from 'sentry/components/performance/waterfall/constants';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import toPercent from 'sentry/utils/number/toPercent';

import {EnhancedSpan} from './types';
import {SpanViewBoundsType} from './utils';

export default function SpanRectangle({
  bounds,
  spanBarType,
}: {
  bounds: SpanViewBoundsType;
  spanGrouping: EnhancedSpan[];
  spanBarType?: SpanBarType;
}) {
  const theme = useTheme();
  return (
    <RowRectangle
      style={{
        backgroundColor: getSpanBarColours(spanBarType, theme).primary,
        left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
        width: toPercent(bounds.width || 0),
      }}
    />
  );
}
