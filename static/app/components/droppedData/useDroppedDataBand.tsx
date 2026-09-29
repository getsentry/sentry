import {useCallback, useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';
import type {TooltipPositionCallback} from 'echarts/types/dist/shared';

import {useTimezone} from '@sentry/scraps/datetime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {isChartHovered} from 'sentry/components/charts/utils';
import {DroppedDataTooltip} from 'sentry/components/droppedData/droppedDataTooltip';
import type {DroppedDataProps} from 'sentry/components/droppedData/types';
import {
  groupIntoBuckets,
  MIN_HIGHLIGHTED_RATIO,
  severityStyle,
  type AnnotationBucket,
  type SeverityStyle,
} from 'sentry/components/droppedData/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

const BAND_PADDING = 4;
const BOX_HEIGHT = 4;
export const BAND_HEIGHT = BAND_PADDING + BOX_HEIGHT + BAND_PADDING;
const BOX_BORDER_RADIUS = 2;
const TOOLTIP_GAP = 8;
const TRACK_OPACITY = 0.04;

const DROPPED_DATA_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  axisLabel: {show: false},
  axisPointer: {show: false},
};

interface DroppedDataItem extends AnnotationBucket {
  severity: SeverityStyle;
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

type BandGroup = Extract<NonNullable<CustomSeriesRenderItemReturn>, {type: 'group'}>;
type BandElement = BandGroup['children'][number];

type CartesianCoordSys = CustomSeriesRenderItemParams['coordSys'] & {
  width: number;
  x: number;
};

interface PixelRange {
  left: number;
  right: number;
}

function clampRange({left, right}: PixelRange, track: PixelRange): PixelRange {
  return {
    left: Math.min(Math.max(left, track.left), track.right),
    right: Math.min(Math.max(right, track.left), track.right),
  };
}

/**
 * Centred on the bucket start to line up with bar series, and rounded so
 * neighbouring buckets meet without anti-aliased seams.
 */
function bucketSlot(
  bucket: AnnotationBucket,
  api: CustomSeriesRenderItemAPI
): PixelRange | null {
  const [startX] = api.coord([bucket.start, 0]);
  const [endX] = api.coord([bucket.end, 0]);

  if (!defined(startX) || !defined(endX)) {
    return null;
  }

  const halfSlot = (endX - startX) / 2;
  return {left: Math.round(startX - halfSlot), right: Math.round(endX - halfSlot)};
}

/**
 * Rounds only the corners that sit on the ends of the track, so segments
 * inside the band read as one continuous line.
 */
function bandRect(
  range: PixelRange,
  y: number,
  track: PixelRange,
  style: SeverityStyle,
  options: {silent?: boolean; z2?: number} = {}
): BandElement {
  const left = range.left <= track.left ? BOX_BORDER_RADIUS : 0;
  const right = range.right >= track.right ? BOX_BORDER_RADIUS : 0;

  return {
    type: 'rect',
    ...options,
    shape: {
      x: range.left,
      y,
      width: range.right - range.left,
      height: BOX_HEIGHT,
      r: [left, right, right, left],
    },
    style: {
      ...style,
      // Fakes padding so hovering anywhere in the band opens the tooltip.
      lineWidth: BAND_PADDING * 2,
      stroke: 'transparent',
    },
  };
}

function droppedDataRenderItem(
  data: DroppedDataItem[],
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItem {
  const trackStyle = {fill: theme.tokens.dataviz.semantic.bad, opacity: TRACK_OPACITY};

  return function renderDroppedDataItem(params, api) {
    const bucket = data[params.dataIndex];
    if (!bucket) {
      return null;
    }

    const slot = bucketSlot(bucket, api);
    const [, baseY] = api.coord([bucket.start, 0]);
    if (!slot || !defined(baseY)) {
      return null;
    }

    const {x, width} = params.coordSys as CartesianCoordSys;
    const track = {left: x, right: x + width};
    const y = baseY + bandOffset + BAND_PADDING;

    const children = [bandRect(clampRange(slot, track), y, track, bucket.severity)];

    if (params.dataIndexInside === 0) {
      children.unshift(bandRect(track, y, track, trackStyle, {silent: true, z2: -1}));
    }

    return {type: 'group', children};
  };
}

/**
 * Small position fn to see if tooltip is at the edge of the chart
 * and adjust accordingly.
 */
const droppedDataTooltipPosition: TooltipPositionCallback = (
  point,
  _params,
  dom,
  rect,
  size
) => {
  const [tooltipWidth] = size.contentSize;
  const [chartWidth] = size.viewSize;

  const anchorX = rect ? rect.x + rect.width / 2 : point[0];
  const anchorBottom = rect ? rect.y + rect.height : point[1];

  const centeredLeft = anchorX - tooltipWidth / 2;
  const left = Math.max(0, Math.min(centeredLeft, chartWidth - tooltipWidth));

  if (dom instanceof HTMLElement) {
    const arrow = dom.querySelector<HTMLDivElement>('.tooltip-arrow');
    if (arrow) {
      arrow.style.left = left === centeredLeft ? '50%' : `${anchorX - left}px`;
    }
  }

  return [left, anchorBottom + TOOLTIP_GAP];
};

function droppedDataTooltipOption(
  chartRef: React.RefObject<ReactEchartsRef | null>,
  renderTooltip: (bucket: AnnotationBucket) => string
): CustomSeriesOption['tooltip'] {
  return {
    trigger: 'item',
    position: droppedDataTooltipPosition,
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
    severity: severityStyle(bucket.ratio, theme),
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
  droppedData?: DroppedDataProps;
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
  const {acceptedAnnotations, droppedAnnotations} = droppedData ?? {};

  const buckets = useMemo(
    () =>
      groupIntoBuckets(droppedAnnotations ?? [], acceptedAnnotations ?? [])
        .filter(bucket => bucket.ratio >= MIN_HIGHLIGHTED_RATIO)
        .sort((a, b) => a.start - b.start),
    [acceptedAnnotations, droppedAnnotations]
  );
  const isVisible = buckets.length > 0;

  // TODO: reconsider using the tooltip from the main chart
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
