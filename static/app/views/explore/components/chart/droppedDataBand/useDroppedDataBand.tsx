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
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {renderDroppedDataTooltip} from 'sentry/views/explore/components/chart/droppedDataBand/droppedDataTooltip';
import {
  groupIntoBuckets,
  type AnnotationBucket,
} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

// TODO: this should change to read from the outcome property when backend changes are in
const CLIENT_DISCARD_LABEL = 'Client discard';

// Styling constants
const BAR_SLOT_FILL = 0.69;
const BOX_GAP = 2;
const BAND_PADDING = 4;
const BOX_HEIGHT = 8;
export const BAND_HEIGHT = BAND_PADDING + BOX_HEIGHT + BAND_PADDING;
const BOX_BORDER_RADIUS = 2;
const SEVERITY_OPACITIES = [0.3, 0.5, 0.7, 1] as const;

function severityOpacity(severity: number): number {
  const index = Math.min(Math.max(severity, 1), SEVERITY_OPACITIES.length) - 1;
  return SEVERITY_OPACITIES[index] ?? 1;
}

/**
 * The buckets that will actually be drawn. Client discards are filtered out
 * to prevent noisy data cluttering the band
 */
function getVisibleBuckets(annotations: Annotation[] | undefined): AnnotationBucket[] {
  return groupIntoBuckets(
    (annotations ?? []).filter(annotation => annotation.label !== CLIENT_DISCARD_LABEL)
  ).filter(bucket => bucket.severity > 0);
}

const DROPPED_DATA_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  axisLabel: {show: false},
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

interface DroppedDataItem extends AnnotationBucket {
  value: [start: number, low: number, end: number, droppedTotal: number];
}

interface DroppedDataSeriesProps {
  alignInMiddle: boolean;
  buckets: AnnotationBucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  theme: Theme;
  yAxisIndex?: number;
}

function createDroppedDataSeries({
  alignInMiddle,
  buckets,
  chartRef,
  theme,
  yAxisIndex,
}: DroppedDataSeriesProps): CustomSeriesOption {
  const data: DroppedDataItem[] = buckets.map(bucket => ({
    value: [bucket.start, 0, bucket.end, bucket.droppedTotal],
    ...bucket,
  }));

  const renderDroppedDataBox: CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) => {
    const dataItem = data[params.dataIndex];

    if (!dataItem) {
      return null;
    }

    const [boxStartX, boxStartY] = api.coord([dataItem.start, 0]);
    const [boxEndX] = api.coord([dataItem.end, 0]);

    if (!defined(boxStartX) || !defined(boxStartY) || !defined(boxEndX)) {
      return null;
    }

    const slotWidth = boxEndX - boxStartX;
    // Box width adjusts based on chart type selection
    const boxWidth = Math.max(
      alignInMiddle ? slotWidth * BAR_SLOT_FILL : slotWidth - BOX_GAP,
      0
    );
    const slotLeft = boxStartX - (alignInMiddle ? slotWidth / 2 : 0);
    const x = slotLeft + (slotWidth - boxWidth) / 2;
    const boxTop = boxStartY + BAND_PADDING;

    return {
      type: 'group',
      children: [
        {
          // Invisible hit target so the box is easy to hover.
          type: 'rect',
          shape: {
            x,
            y: boxStartY,
            width: boxWidth,
            height: BAND_HEIGHT,
          },
          style: {
            fill: 'transparent',
          },
        },
        {
          // The single severity box. Its hue/intensity encodes severity.
          type: 'rect' as const,
          silent: true,
          shape: {
            x,
            y: boxTop,
            width: boxWidth,
            height: BOX_HEIGHT,
            r: BOX_BORDER_RADIUS,
          },
          style: {
            fill: theme.tokens.dataviz.semantic.bad,
            opacity: severityOpacity(dataItem.severity),
          },
        },
      ],
    } satisfies CustomSeriesRenderItemReturn;
  };

  return {
    id: DROPPED_DATA_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: renderDroppedDataBox,
    name: DROPPED_DATA_SERIES_ID,
    data,
    color: theme.tokens.dataviz.semantic.bad,
    animation: false,
    legendHoverLink: false,
    tooltip: {
      trigger: 'item',
      position: 'bottom',
      formatter: params => {
        if (!isChartHovered(chartRef?.current)) {
          return '';
        }
        const param = Array.isArray(params) ? params[0] : params;
        const dataIndex = param?.dataIndex;
        const bucket = defined(dataIndex) ? data[dataIndex] : undefined;

        return bucket ? renderDroppedDataTooltip() : '';
      },
    },
  };
}

interface UseDroppedDataBandParams {
  alignInMiddle?: boolean;
  annotations?: Annotation[];
  showDroppedData?: boolean;
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

  const buckets = useMemo(() => getVisibleBuckets(annotations), [annotations]);

  const handleChartRef = useCallback((e: ReactEchartsRef | null) => {
    chartRef.current = e;
  }, []);

  const droppedDataSeries = useMemo(
    () =>
      buckets.length
        ? // oxlint-disable-next-line react/refs
          createDroppedDataSeries({
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
