import type {CustomSeriesOption} from 'echarts';

import {horizontalTooltipPosition} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';

const TOOLTIP_GAP = 8;

/**
 * An item tooltip that opens below the hovered bucket, with its arrow kept on
 * the bucket when the tooltip is pinned inside the viewport.
 */
export function bandTooltipOption<Item>(
  chartRef: React.RefObject<ReactEchartsRef | null>,
  data: Item[],
  renderTooltip: (item: Item) => string
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
      const item = data[params.dataIndex];
      if (!item || !isChartHovered(chartRef.current)) {
        return '';
      }

      return renderTooltip(item);
    },
  };
}
