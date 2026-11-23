import type {CustomSeriesOption} from 'echarts';
import type {TooltipPositionCallback} from 'echarts/types/dist/shared';

import {useTimezone} from '@sentry/scraps/dateTime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {horizontalTooltipPosition} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

import type {BandBucket} from './bandShapes';
import {ChartBandTooltip} from './chartBandTooltip';
import type {ChartBand} from './mergeChartBands';

const TOOLTIP_GAP = 8;

interface TooltipAnchor {
  bottom: number;
  x: number;
}

type TooltipAnchorGetter = (
  point: [number, number],
  rect: Parameters<TooltipPositionCallback>[3]
) => TooltipAnchor;

/**
 * An item tooltip that opens below its anchor, with its arrow kept on the
 * anchor when the tooltip is pinned inside the viewport.
 */
export function itemTooltipBelowAnchor(
  chartRef: React.RefObject<ReactEchartsRef | null>,
  getAnchor: TooltipAnchorGetter,
  renderTooltip: (dataIndex: number) => string
): CustomSeriesOption['tooltip'] {
  return {
    trigger: 'item',
    position(point, _params, dom, rect, size) {
      const [tipWidth] = size.contentSize;
      const anchor = getAnchor(point, rect);

      const {left, arrowLeft} = horizontalTooltipPosition({
        anchorX: anchor.x,
        chartLeft: chartRef.current?.ele?.getBoundingClientRect().left ?? 0,
        tipWidth,
      });

      if (dom instanceof HTMLElement) {
        const arrow = dom.querySelector<HTMLDivElement>('.tooltip-arrow');
        if (arrow) {
          arrow.style.left = arrowLeft;
        }
      }

      return {left, top: anchor.bottom + TOOLTIP_GAP};
    },
    formatter: params =>
      isChartHovered(chartRef.current) ? renderTooltip(params.dataIndex) : '',
  };
}

const bucketAnchor: TooltipAnchorGetter = (point, rect) =>
  rect
    ? {x: rect.x + rect.width / 2, bottom: rect.y + rect.height}
    : {x: point[0], bottom: point[1]};

function bandTooltipOption(
  chartRef: React.RefObject<ReactEchartsRef | null>,
  buckets: BandBucket[],
  renderTooltip: (bucket: BandBucket) => string
): CustomSeriesOption['tooltip'] {
  return itemTooltipBelowAnchor(chartRef, bucketAnchor, dataIndex => {
    const bucket = buckets[dataIndex];
    return bucket ? renderTooltip(bucket) : '';
  });
}

interface UseBandTooltipsParams {
  chartRef: React.RefObject<ReactEchartsRef | null>;
  utc?: boolean | null;
}

export function useBandTooltips(
  bands: Array<ChartBand | null>,
  {chartRef, utc}: UseBandTooltipsParams
): ChartBand[] {
  const renderToString = useRenderToString();
  const userTimezone = useTimezone();
  const timezone = utc ? 'UTC' : userTimezone;
  const visibleBands = bands.filter(defined);

  function renderTooltip(bucket: BandBucket): string {
    const sections = visibleBands
      .map(band => band.tooltipSection?.(bucket.start))
      .filter(defined);
    if (sections.length === 0) {
      return '';
    }

    return renderToString(
      <ChartBandTooltip bucket={bucket} sections={sections} timezone={timezone} />
    );
  }

  return visibleBands.map(band =>
    band.tooltipSection
      ? {
          ...band,
          series: offset => ({
            ...band.series(offset),
            tooltip: bandTooltipOption(chartRef, band.buckets, renderTooltip),
          }),
        }
      : band
  );
}
