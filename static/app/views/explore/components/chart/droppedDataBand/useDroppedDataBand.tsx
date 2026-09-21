import {useCallback, useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';

import {useTimezone} from '@sentry/scraps/datetime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {isChartHovered} from 'sentry/components/charts/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {DroppedDataTooltip} from 'sentry/views/explore/components/chart/droppedDataBand/droppedDataTooltip';
import {
  groupIntoBuckets,
  SEVERITY_OPACITIES,
  type AnnotationBucket,
} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

// Styling constants
const BAR_SLOT_FILL = 0.69;
const BAND_PADDING = 4;
const BOX_HEIGHT = 8;
export const BAND_HEIGHT = BAND_PADDING + BOX_HEIGHT + BAND_PADDING;
const BOX_BORDER_RADIUS = 2;

function severityOpacity(severity: number): number {
  return SEVERITY_OPACITIES[severity - 1] ?? 1;
}

const DROPPED_DATA_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  axisLabel: {show: false},
  axisPointer: {show: false},
};

interface DroppedDataItem extends AnnotationBucket {
  value: [start: number, y: number];
}

interface DroppedDataSeriesProps {
  bandOffset: number;
  buckets: AnnotationBucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  renderTooltip: (bucket: AnnotationBucket) => string;
  theme: Theme;
  yAxisIndex?: number;
}

function createDroppedDataSeries({
  bandOffset,
  buckets,
  chartRef,
  renderTooltip,
  theme,
  yAxisIndex,
}: DroppedDataSeriesProps): CustomSeriesOption {
  const data: DroppedDataItem[] = buckets.map(bucket => ({
    value: [bucket.start, 0],
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

    const boxWidth = (boxEndX - boxStartX) * BAR_SLOT_FILL;
    const boxTop = boxStartY + bandOffset + BAND_PADDING;

    return {
      // The single severity box. Its hue/intensity encodes severity.
      type: 'rect',
      shape: {
        x: boxStartX - boxWidth / 2,
        y: boxTop,
        width: boxWidth,
        height: BOX_HEIGHT,
        r: BOX_BORDER_RADIUS,
      },
      style: {
        lineWidth: BAND_PADDING * 2,
        stroke: 'transparent',
        fill: theme.tokens.dataviz.semantic.bad,
        opacity: severityOpacity(dataItem.severity),
      },
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
        if (!isChartHovered(chartRef.current)) {
          return '';
        }

        return renderTooltip(params.data as DroppedDataItem);
      },
    },
  };
}

interface UseDroppedDataBandParams {
  chartRef: React.RefObject<ReactEchartsRef | null>;
  acceptedAnnotations?: Annotation[];
  bandOffset?: number;
  droppedAnnotations?: Annotation[];
  showDroppedData?: boolean;
  utc?: boolean | null;
  yAxisIndex?: number;
}

export function useDroppedDataBand({
  chartRef,
  acceptedAnnotations,
  droppedAnnotations,
  showDroppedData = true,
  bandOffset = 0,
  utc,
  yAxisIndex,
}: UseDroppedDataBandParams) {
  const theme = useTheme();
  const renderToString = useRenderToString();
  const userTimezone = useTimezone();
  const timezone = utc ? 'UTC' : userTimezone;

  const buckets = useMemo(
    () =>
      groupIntoBuckets(droppedAnnotations ?? [], acceptedAnnotations ?? []).filter(
        bucket => bucket.severity > 0
      ),
    [acceptedAnnotations, droppedAnnotations]
  );
  const isVisible = showDroppedData && buckets.length > 0;

  const renderTooltip = useCallback(
    (bucket: AnnotationBucket) =>
      renderToString(<DroppedDataTooltip bucket={bucket} timezone={timezone} />),
    [renderToString, timezone]
  );

  const droppedDataSeries = useMemo(
    () =>
      isVisible
        ? createDroppedDataSeries({
            bandOffset,
            buckets,
            chartRef,
            renderTooltip,
            theme,
            yAxisIndex,
          })
        : null,
    [bandOffset, buckets, chartRef, isVisible, renderTooltip, theme, yAxisIndex]
  );

  return {
    droppedDataSeries,

    droppedDataYAxis: isVisible ? DROPPED_DATA_Y_AXIS : null,
    droppedDataBandHeight: isVisible ? BAND_HEIGHT : 0,
  };
}
