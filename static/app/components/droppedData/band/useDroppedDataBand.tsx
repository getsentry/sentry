import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesRenderItem, CustomSeriesRenderItemAPI} from 'echarts';
import type {LinearGradientObject} from 'echarts/types/dist/shared';

import {useTimezone} from '@sentry/scraps/datetime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {
  BAND_HEIGHT,
  bandLayout,
  bandRect,
  bandTrack,
  bucketSlot,
  clampRange,
  type BandElement,
  type PixelRange,
} from 'sentry/components/charts/bands/bandShapes';
import {bandTooltipOption} from 'sentry/components/charts/bands/bandTooltip';
import type {ChartBand} from 'sentry/components/charts/bands/mergeChartBands';
import {groupIntoBuckets, isHighlighted} from 'sentry/components/droppedData/buckets';
import type {
  DroppedDataBucket,
  DroppedDataProps,
} from 'sentry/components/droppedData/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

import {DroppedDataTooltip} from './droppedDataTooltip';
import {severityColor, withAlpha} from './severityColor';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

const BLEND_WIDTH = 0.3;
const MAX_BLEND_WIDTH = 8;

interface DroppedDataItem extends DroppedDataBucket {
  fill: string;
  value: [start: number, y: number];
}

interface DroppedDataBandParams {
  buckets: DroppedDataBucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  renderTooltip: (bucket: DroppedDataBucket) => string;
  theme: Theme;
  onClick?: () => void;
}

interface BandGradient {
  fill: LinearGradientObject;
  range: PixelRange;
}

function bandGradient(
  data: DroppedDataItem[],
  api: CustomSeriesRenderItemAPI
): BandGradient | null {
  const stops: Array<{color: string; x: number}> = [];

  data.forEach((bucket, index) => {
    const slot = bucketSlot(bucket, api);
    if (!slot) {
      return;
    }

    const blend = Math.min((slot.right - slot.left) * BLEND_WIDTH, MAX_BLEND_WIDTH);
    const clear = withAlpha(bucket.fill, 0);

    if (data[index - 1]?.end !== bucket.start) {
      stops.push({x: slot.left - blend, color: clear});
    }
    stops.push(
      {x: slot.left + blend, color: bucket.fill},
      {x: slot.right - blend, color: bucket.fill}
    );
    if (data[index + 1]?.start !== bucket.end) {
      stops.push({x: slot.right + blend, color: clear});
    }
  });

  const first = stops[0];
  const last = stops.at(-1);
  if (!first || !last || last.x <= first.x) {
    return null;
  }

  const range = {left: first.x, right: last.x};
  const width = range.right - range.left;

  return {
    range,
    fill: {
      type: 'linear',
      global: true,
      x: range.left,
      y: 0,
      x2: range.right,
      y2: 0,
      colorStops: stops.map(stop => ({
        offset: (stop.x - range.left) / width,
        color: stop.color,
      })),
    },
  };
}

function droppedDataRenderItem(
  data: DroppedDataItem[],
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItem {
  const highlighted = data.filter(isHighlighted);

  return function renderDroppedDataItem(params, api) {
    const bucket = data[params.dataIndex];
    if (!bucket) {
      return null;
    }

    const slot = bucketSlot(bucket, api);
    const layout = bandLayout(bucket, bandOffset, params, api);
    if (!slot || !layout) {
      return null;
    }

    const {track, y} = layout;
    const children: BandElement[] = [];

    if (params.dataIndexInside === 0) {
      children.push(bandTrack(track, y, theme));

      const gradient = bandGradient(highlighted, api);
      if (gradient) {
        children.push(
          bandRect(clampRange(gradient.range, track), y, track, gradient.fill, {
            silent: true,
          })
        );
      }
    }

    children.push(bandRect(clampRange(slot, track), y, track, 'transparent'));

    return {type: 'group', children};
  };
}

function createDroppedDataBand({
  buckets,
  chartRef,
  onClick,
  renderTooltip,
  theme,
}: DroppedDataBandParams): ChartBand {
  const data: DroppedDataItem[] = buckets.map(bucket => ({
    value: [bucket.start, 0],
    fill: severityColor(bucket.ratio, theme),
    ...bucket,
  }));
  const tooltip = bandTooltipOption(chartRef, data, renderTooltip);

  return {
    id: DROPPED_DATA_SERIES_ID,
    height: BAND_HEIGHT,
    onClick,
    series: bandOffset => ({
      type: 'custom',
      renderItem: droppedDataRenderItem(data, bandOffset, theme),
      name: DROPPED_DATA_SERIES_ID,
      data,
      color: theme.tokens.dataviz.semantic.bad,
      animation: false,
      legendHoverLink: false,
      tooltip,
    }),
  };
}

interface UseDroppedDataBandParams {
  chartRef: React.RefObject<ReactEchartsRef | null>;
  droppedData?: DroppedDataProps;
  utc?: boolean | null;
}

export function useDroppedDataBand({
  chartRef,
  droppedData,
  utc,
}: UseDroppedDataBandParams): ChartBand | null {
  const theme = useTheme();
  const renderToString = useRenderToString();
  const userTimezone = useTimezone();
  const timezone = utc ? 'UTC' : userTimezone;
  const {acceptedEvents, dataset, droppedEvents, onClick} = droppedData ?? {};

  const buckets = useMemo(
    () =>
      groupIntoBuckets(droppedEvents ?? [], acceptedEvents).sort(
        (a, b) => a.start - b.start
      ),
    [acceptedEvents, droppedEvents]
  );
  const isVisible = buckets.some(isHighlighted);

  return useMemo(
    () =>
      isVisible && defined(dataset)
        ? createDroppedDataBand({
            buckets,
            chartRef,
            onClick,
            renderTooltip: bucket =>
              renderToString(
                <DroppedDataTooltip
                  bucket={bucket}
                  dataset={dataset}
                  timezone={timezone}
                />
              ),
            theme,
          })
        : null,
    [buckets, chartRef, dataset, isVisible, onClick, renderToString, theme, timezone]
  );
}
