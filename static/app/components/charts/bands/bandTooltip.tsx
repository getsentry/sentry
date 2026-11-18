import type {CustomSeriesOption} from 'echarts';

import {useTimezone} from '@sentry/scraps/datetime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {horizontalTooltipPosition} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

import type {BandBucket} from './bandShapes';
import {ChartBandTooltip} from './chartBandTooltip';
import type {ChartBand} from './mergeChartBands';

const TOOLTIP_GAP = 8;

/**
 * An item tooltip that opens below the hovered bucket, with its arrow kept on
 * the bucket when the tooltip is pinned inside the viewport.
 */
function bandTooltipOption(
  chartRef: React.RefObject<ReactEchartsRef | null>,
  buckets: BandBucket[],
  renderTooltip: (bucket: BandBucket) => string
): CustomSeriesOption['tooltip'] {
  return {
    trigger: 'item',
    position(point, _params, dom, rect, size) {
      const [tipWidth] = size.contentSize;
      const anchorX = rect ? rect.x + rect.width / 2 : point[0];
      const anchorBottom = rect ? rect.y + rect.height : point[1];

      const {left, arrowLeft} = horizontalTooltipPosition({
        anchorX,
        chartLeft: chartRef.current?.ele?.getBoundingClientRect().left ?? 0,
        tipWidth,
      });

      if (dom instanceof HTMLElement) {
        const arrow = dom.querySelector<HTMLDivElement>('.tooltip-arrow');
        if (arrow) {
          arrow.style.left = arrowLeft;
        }
      }

      return {left, top: anchorBottom + TOOLTIP_GAP};
    },
    formatter: params => {
      const bucket = buckets[params.dataIndex];
      if (!bucket || !isChartHovered(chartRef.current)) {
        return '';
      }

      return renderTooltip(bucket);
    },
  };
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
