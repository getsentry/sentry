import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import {getSampleChartSymbol} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/getSampleChartSymbol';
import {SPAN_ID_DISPLAY_LENGTH} from 'sentry/views/insights/http/settings';
import type {SpanIndexedResponse} from 'sentry/views/insights/types';

/** Given an array of indexed spans, create a `Series` for each one, and set the correct styling based on how it compares to the average value. This is a hack, in which our `Chart` component doesn't work otherwise. The right solution would be to create a single series of `type: "scatter"` but that doesn' work with the current implementation */
export function useSampleScatterPlotSeries(
  spans: Array<Partial<SpanIndexedResponse>>,
  average?: number,
  highlightedSpanId?: string,
  key = 'span.self_time'
): Series[] {
  const theme = useTheme();

  return spans.map(span => {
    let symbol, color;

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (span[key] && defined(average)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      ({symbol, color} = getSampleChartSymbol(span[key], average, theme));
    } else {
      symbol = 'circle';
      color = AVG_COLOR;
    }

    const series: Series = {
      data: [
        {
          name: span?.timestamp ?? span.span_id ?? t('Span'),
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          value: span?.[key] ?? 0,
        },
      ],
      symbol,
      color,
      symbolSize: span?.span_id === highlightedSpanId ? 19 : 14,
      seriesName: span?.span_id?.substring(0, SPAN_ID_DISPLAY_LENGTH) ?? t('Sample'),
    };

    return series;
  });
}
