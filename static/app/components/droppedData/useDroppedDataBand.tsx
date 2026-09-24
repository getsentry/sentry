import {useCallback, useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemReturn,
} from 'echarts';

import {useTimezone} from '@sentry/scraps/datetime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {isChartHovered} from 'sentry/components/charts/utils';
import {DroppedDataTooltip} from 'sentry/components/droppedData/droppedDataTooltip';
import {
  groupIntoBuckets,
  opacityForRatio,
  type AnnotationBucket,
  type DroppedData,
} from 'sentry/components/droppedData/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

// Styling constants
const BAR_SLOT_FILL = 0.69;
const BAND_PADDING = 4;
const BOX_HEIGHT = 8;
export const BAND_HEIGHT = BAND_PADDING + BOX_HEIGHT + BAND_PADDING;
const BOX_BORDER_RADIUS = 2;

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

interface DroppedDataSeriesParams {
  bandOffset: number;
  buckets: AnnotationBucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  renderTooltip: (bucket: AnnotationBucket) => string;
  theme: Theme;
  yAxisIndex?: number;
}

interface PillPosition {
  width: number;
  x: number;
  y: number;
}

/**
 * The single drop pill. Opacity encodes how much data is missing.
 */
function droppedDataPill(
  {x, y, width}: PillPosition,
  ratio: number,
  theme: Theme
): CustomSeriesRenderItemReturn {
  return {
    type: 'rect',
    shape: {
      x,
      y,
      width,
      height: BOX_HEIGHT,
      r: BOX_BORDER_RADIUS,
    },
    style: {
      lineWidth: BAND_PADDING * 2,
      stroke: 'transparent',
      fill: theme.tokens.dataviz.semantic.bad,
      opacity: opacityForRatio(ratio),
    },
  };
}

function droppedDataBox(
  dataItem: DroppedDataItem,
  api: CustomSeriesRenderItemAPI,
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItemReturn {
  const [boxStartX, boxStartY] = api.coord([dataItem.start, 0]);
  const [boxEndX] = api.coord([dataItem.end, 0]);

  if (!defined(boxStartX) || !defined(boxStartY) || !defined(boxEndX)) {
    return null;
  }

  const boxWidth = (boxEndX - boxStartX) * BAR_SLOT_FILL;
  const position = {
    x: boxStartX - boxWidth / 2,
    y: boxStartY + bandOffset + BAND_PADDING,
    width: boxWidth,
  };

  return droppedDataPill(position, dataItem.ratio, theme);
}

function droppedDataRenderItem(
  data: DroppedDataItem[],
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItem {
  return function renderDroppedDataItem(params, api) {
    const dataItem = data[params.dataIndex];
    return dataItem ? droppedDataBox(dataItem, api, bandOffset, theme) : null;
  };
}

function droppedDataTooltipOption(
  chartRef: React.RefObject<ReactEchartsRef | null>,
  renderTooltip: (bucket: AnnotationBucket) => string
): CustomSeriesOption['tooltip'] {
  return {
    trigger: 'item',
    position: 'bottom',
    formatter: params => {
      if (!isChartHovered(chartRef.current)) {
        return '';
      }

      return renderTooltip(params.data as DroppedDataItem);
    },
  };
}

function createDroppedDataSeries({
  bandOffset,
  buckets,
  chartRef,
  renderTooltip,
  theme,
  yAxisIndex,
}: DroppedDataSeriesParams): CustomSeriesOption {
  const data: DroppedDataItem[] = buckets.map(bucket => ({
    value: [bucket.start, 0],
    ...bucket,
  }));

  return {
    id: DROPPED_DATA_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: droppedDataRenderItem(data, bandOffset, theme),
    name: DROPPED_DATA_SERIES_ID,
    data,
    color: theme.tokens.dataviz.semantic.bad,
    animation: false,
    legendHoverLink: false,
    tooltip: droppedDataTooltipOption(chartRef, renderTooltip),
  };
}

interface UseDroppedDataBandParams {
  chartRef: React.RefObject<ReactEchartsRef | null>;
  bandOffset?: number;
  droppedData?: DroppedData;
  utc?: boolean | null;
  yAxisIndex?: number;
}

export function useDroppedDataBand({
  chartRef,
  droppedData,
  bandOffset = 0,
  utc,
  yAxisIndex,
}: UseDroppedDataBandParams) {
  const theme = useTheme();
  const renderToString = useRenderToString();
  const userTimezone = useTimezone();
  const timezone = utc ? 'UTC' : userTimezone;
  const {accepted, dropped, visible = true} = droppedData ?? {};

  const buckets = useMemo(
    () =>
      groupIntoBuckets(dropped ?? [], accepted ?? []).filter(bucket => bucket.ratio > 0),
    [accepted, dropped]
  );
  const isVisible = visible && buckets.length > 0;

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
