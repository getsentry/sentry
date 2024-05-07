import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {SPAN_ID_DISPLAY_LENGTH} from 'sentry/views/performance/http/settings';
import {AVG_COLOR} from 'sentry/views/starfish/colors';
import type {IndexedResponse} from 'sentry/views/starfish/types';
import {getSampleChartSymbol} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/getSampleChartSymbol';

/** Given an array of indexed spans, create a `Series` for each one, and set the correct styling based on how it compares to the average value. This is a hack, in which our `Chart` component doesn't work otherwise. The right solution would be to create a single series of `type: "scatter"` but that doesn' work with the current implementation */
export function useSampleScatterPlotSeries(
  spans: Partial<IndexedResponse>[],
  average?: number,
  highlightedSpanId?: string
): Series[] {
  const theme = useTheme();

  return spans.map(span => {
    let symbol, color;

    if (span['span.self_time'] && defined(average)) {
      ({symbol, color} = getSampleChartSymbol(span['span.self_time'], average, theme));
    } else {
      symbol = 'circle';
      color = AVG_COLOR;
    }

    const series: Series = {
      data: [
        {
          name: span?.timestamp ?? span.span_id ?? t('Span'),
          value: span?.['span.self_time'] ?? 0,
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
