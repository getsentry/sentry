import {useCallback, useMemo, useRef} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';

import {isChartHovered} from 'sentry/components/charts/utils';
import {tn} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {escape} from 'sentry/utils';
import {defined} from 'sentry/utils/defined';
import type {DataFidelityAnnotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {
  BAND_HEIGHT,
  BAND_PADDING,
  groupIntoBuckets,
  PILL_GAP,
  PILL_HEIGHT,
  type Bucket,
} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

// ECharts does not use the documented 20% `barCategoryGap` when the option is
// omitted. For a single stacked series it picks max(35 - 4, 15)% = 31%, so
// bars fill 69% of the time slot. Matching that keeps pills from overrunning
// the columns.
const BAR_SLOT_FILL = 0.69;

const DROPPED_DATA_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  // `axisLabel` causes an unwanted whitespace/width on the y-axis.
  axisLabel: {show: false},
  // The main y-axis may enable this via `tooltip.trigger=axis`.
  axisPointer: {show: false},
};

const DROPPED_DATA_X_AXIS = {
  axisLine: {onZero: false as const},
  offset: BAND_HEIGHT,
};

const DROPPED_DATA_GRID = {
  bottom: BAND_HEIGHT + 1,
};

const EMPTY_DROPPED_DATA_BAND = {
  connectDroppedDataChartRef: (_e: ReactEchartsRef | null) => {},
  droppedDataGrid: {},
  droppedDataSeries: null,
  droppedDataXAxis: {},
  droppedDataYAxis: null,
};

interface DroppedDataSeriesProps {
  alignInMiddle: boolean;
  buckets: Bucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  theme: Theme;
  yAxisIndex?: number;
}

function formatBucketTooltip(bucket: Bucket): string {
  const annotationLines = bucket.annotations
    .map(
      annotation =>
        `<div>${escape(annotation.label)} — ${annotation.droppedCount.toLocaleString()}</div>`
    )
    .join('');

  return `
<div class="tooltip-series">
<div>
${tn('%s event dropped', '%s events dropped', bucket.total)}
</div>
${annotationLines}
</div>
<div class="tooltip-arrow arrow-top"></div>
`;
}

function createDroppedDataSeries({
  alignInMiddle,
  buckets,
  chartRef,
  theme,
  yAxisIndex,
}: DroppedDataSeriesProps): CustomSeriesOption {
  const data = buckets.map(bucket => ({
    value: [bucket.start, 0, bucket.end, bucket.total],
    ...bucket,
  }));

  const renderDroppedDataPills: CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) => {
    const dataItem = data[params.dataIndex];

    if (!dataItem) {
      return null;
    }

    // Use the start/end timestamps to get the chart coordinates. The 2nd tuple
    // passed to `api.coord()` is always 0 because pills have a static height
    // and are drawn in pixel space below the grid.
    const [pillStartX, pillStartY] = api.coord([dataItem.start, 0]);
    const [pillEndX] = api.coord([dataItem.end, 0]);

    if (!defined(pillStartX) || !defined(pillStartY) || !defined(pillEndX)) {
      return null;
    }

    const slotWidth = pillEndX - pillStartX;
    const pillWidth = Math.max(slotWidth * BAR_SLOT_FILL, 0);
    const slotLeft = pillStartX - (alignInMiddle ? slotWidth / 2 : 0);
    const x = slotLeft + (slotWidth - pillWidth) / 2;
    // `BAND_PADDING` above the stack (under the bars) and below it (above
    // the x-axis line). Offset equals BAND_HEIGHT so the axis sits after
    // the bottom padding instead of overlapping it.
    const pillsTop = pillStartY + BAND_PADDING;

    return {
      type: 'group',
      children: [
        {
          // Invisible hit target covering the full reserved band so a severity-1
          // stack is still easy to hover.
          type: 'rect',
          shape: {
            x,
            y: pillStartY,
            width: pillWidth,
            height: BAND_HEIGHT,
          },
          style: {
            fill: 'transparent',
          },
        },
        ...Array.from({length: dataItem.severity}, (_, row) => ({
          type: 'rect' as const,
          silent: true,
          shape: {
            x,
            y: pillsTop + row * (PILL_HEIGHT + PILL_GAP),
            width: pillWidth,
            height: PILL_HEIGHT,
            r: 2,
          },
          style: {
            fill: theme.tokens.graphics.promotion.vibrant,
          },
        })),
      ],
    } satisfies CustomSeriesRenderItemReturn;
  };

  return {
    id: DROPPED_DATA_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: renderDroppedDataPills,
    name: DROPPED_DATA_SERIES_ID,
    data,
    color: theme.tokens.graphics.promotion.vibrant,
    animation: false,
    legendHoverLink: false,
    tooltip: {
      trigger: 'item',
      position: 'bottom',
      formatter: params => {
        // Only show the tooltip of the current chart. Otherwise, all tooltips
        // in the chart group appear.
        if (!isChartHovered(chartRef.current)) {
          return '';
        }

        return formatBucketTooltip(params.data as Bucket);
      },
    },
  };
}

interface UseDroppedDataBandParams {
  /**
   * Align the starting timestamp to the middle of the pill (e.g. if we want to
   * match ECharts' bar charts), otherwise we draw starting at the timestamp.
   */
  alignInMiddle?: boolean;
  annotations?: DataFidelityAnnotation[];
  /**
   * When false, collapse the reserved band and hide the series. Defaults to on
   * so the parent only needs to pass false from the Layers toggle.
   */
  showDroppedData?: boolean;
  /**
   * The index of the dummy y-axis used to convert timestamps to pixel x.
   */
  yAxisIndex?: number;
}

export function useDroppedDataBand({
  annotations,
  showDroppedData = true,
  alignInMiddle = false,
  yAxisIndex,
}: UseDroppedDataBandParams) {
  const theme = useTheme();
  const chartRef = useRef<ReactEchartsRef | null>(null);

  const buckets = useMemo(
    () => groupIntoBuckets(annotations ?? []).filter(bucket => bucket.severity > 0),
    [annotations]
  );

  const handleChartRef = useCallback((e: ReactEchartsRef | null) => {
    chartRef.current = e;
  }, []);

  const droppedDataSeries = useMemo(
    () =>
      buckets.length
        ? createDroppedDataSeries({
            alignInMiddle,
            buckets,
            chartRef,
            theme,
            yAxisIndex,
          })
        : null,
    [alignInMiddle, buckets, theme, yAxisIndex]
  );

  if (!buckets.length || !showDroppedData) {
    return EMPTY_DROPPED_DATA_BAND;
  }

  return {
    connectDroppedDataChartRef: handleChartRef,
    droppedDataSeries,
    droppedDataXAxis: DROPPED_DATA_X_AXIS,
    droppedDataGrid: DROPPED_DATA_GRID,
    droppedDataYAxis: DROPPED_DATA_Y_AXIS,
  };
}
