import {useEffect, useMemo, useRef, useState} from 'react';
import type {ECharts, TooltipComponentFormatterCallbackParams} from 'echarts';

import type {TooltipOption} from 'sentry/components/charts/baseChart';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  useAddSearchFilter,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';

const TOOLTIP_POSITION_X_OFFSET = 20;
const TOOLTIP_POSITION_Y_OFFSET = -10;

type Params = {
  /**
   * The ref to the chart component.
   */
  chartRef: React.RefObject<ReactEchartsRef | null>;
  /**
   * The width of the chart. Used to dynamically position the tooltip to mitigate content fron being cut off.
   */
  chartWidth: number;
  /**
   * The formatter function to format the tooltip content.
   */
  formatter: (params: TooltipComponentFormatterCallbackParams) => string;
  /**
   * The function to render the HTML for the tooltip actions. The actions are rendered on click, anywhere on the chart.
   */
  actionsHtmlRenderer?: (value: string) => string;
};

export enum Actions {
  GROUP_BY = 'group_by_attribute',
  ADD_TO_FILTER = 'add_value_to_filter',
  EXCLUDE_FROM_FILTER = 'exclude_value_from_filter',
  COPY_TO_CLIPBOARD = 'copy_value_to_clipboard',
}

// This hook creates a tooltip configuration for attribute breakdowns charts.
// Since echarts tooltips do not support actions out of the box, we need to handle them manually.
// It is used to freeze the tooltip position and show the tooltip actions on click, anywhere on the chart.
// So that users can intuitively enter the tooltip and click on the actions.
export function useAttributeBreakdownsTooltip({
  chartRef,
  formatter,
  chartWidth,
  actionsHtmlRenderer,
}: Params): TooltipOption {
  const [frozenPosition, setFrozenPosition] = useState<[number, number] | null>(null);
  const tooltipParamsRef = useRef<TooltipComponentFormatterCallbackParams | null>(null);

  const addSearchFilter = useAddSearchFilter();
  const copyToClipboard = useCopyToClipboard();
  const setGroupBys = useSetQueryParamsGroupBys();

  // This effect runs on load and when the frozen position changes.
  // - If frozen position is set, trigger a re-render of the tooltip with frozen position to show the
  //   tooltip actions (if passed in).
  // - Sets up the listener for clicks anywhere on the chart to toggle the frozen tooltip state.
  useEffect(() => {
    const chartInstance: ECharts | undefined = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    if (frozenPosition) {
      chartInstance.dispatchAction({
        type: 'showTip',
        x: frozenPosition[0],
        y: frozenPosition[1],
      });
    }

    const dom = chartInstance.getDom();

    const handleClickAnywhere = (event: MouseEvent) => {
      event.preventDefault();
      const pixelPoint: [number, number] = [event.offsetX, event.offsetY];

      // If the tooltip is frozen, toggle the frozen state and reset the tooltip params.
      if (frozenPosition) {
        setFrozenPosition(null);
        tooltipParamsRef.current = null;
      } else {
        // If the tooltip is not frozen, set the frozen position to the current pixel point.
        setFrozenPosition(pixelPoint);
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      let el = event.relatedTarget as HTMLElement | null;

      // Don't hide actions if the mouse is moving into the tooltip content.
      while (el) {
        if (el.dataset?.attributeBreakdownsChartRegion !== undefined) {
          return;
        }
        el = el.parentElement;
      }

      tooltipParamsRef.current = null;
      setFrozenPosition(null);
    };

    dom.addEventListener('click', handleClickAnywhere);
    dom.addEventListener('mouseleave', handleMouseLeave);

    // eslint-disable-next-line consistent-return
    return () => {
      dom.removeEventListener('click', handleClickAnywhere);
      dom.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [chartRef, frozenPosition]);

  // This effect sets up the on click listeners for the tooltip actions.
  // e-charts tooltips do not support actions out of the box, so we need to handle them manually.
  useEffect(() => {
    if (!frozenPosition) return;

    // TODO Abdullah Khan: Take the actions in as a prop to the hook, to allow other
    // product areas to use the component feature. This is explore specific for now.
    const handleClickActions = (event: MouseEvent) => {
      event.preventDefault();

      const target = event.target as HTMLElement;
      const action = target.getAttribute('data-tooltip-action');
      const key = target.getAttribute('data-tooltip-action-key');
      const value = target.getAttribute('data-tooltip-action-value');

      if (action && value && key) {
        switch (action) {
          case Actions.GROUP_BY:
            setGroupBys([key], Mode.AGGREGATE);
            break;
          case Actions.ADD_TO_FILTER:
            addSearchFilter({
              key,
              value,
            });
            break;
          case Actions.EXCLUDE_FROM_FILTER:
            addSearchFilter({
              key,
              value,
              negated: true,
            });
            break;
          case Actions.COPY_TO_CLIPBOARD:
            copyToClipboard.copy(value);
            break;
          default:
            throw new Error(`Unknown attribute breakdowns tooltip action: ${action}`);
        }
      }
    };

    // Handle hover effects via event delegation (CSP-compliant alternative to inline onmouseover/onmouseout)
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('attribute-breakdowns-tooltip-action-button')) {
        const hoverBg = target.getAttribute('data-hover-background');
        if (hoverBg) {
          target.style.background = hoverBg;
        }
      }
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('attribute-breakdowns-tooltip-action-button')) {
        target.style.background = '';
      }
    };

    // TODO Abdullah Khan: For now, attaching the listener to document.body
    // Tried using a more specific selector causes weird race conditions, will need to investigate.
    document.addEventListener('click', handleClickActions);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    // eslint-disable-next-line consistent-return
    return () => {
      document.removeEventListener('click', handleClickActions);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [frozenPosition, copyToClipboard, addSearchFilter, setGroupBys]);

  const tooltipConfig: TooltipOption = useMemo(
    () => ({
      trigger: 'axis',
      appendToBody: true,
      renderMode: 'html',
      enterable: frozenPosition ? true : false,
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        // Wrap the content in a div with the data-attribute-breakdowns-chart-region attribute
        // to preventthe tooltip from being closed when the mouse is moved to the tooltip content
        // and clicking actions shouldn't clear the chart selection.
        const wrapContent = (content: string) =>
          `<div data-attribute-breakdowns-chart-region>${content}</div>`;

        // If the tooltip is NOT frozen, set the tooltip params and return the formatted content,
        // including the tooltip actions placeholder.
        if (!frozenPosition) {
          tooltipParamsRef.current = params;

          const actionsPlaceholder = `
          <div
            class="tooltip-footer"
            style="
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 10px;
            "
          >
            Click for actions
          </div>
        `.trim();

          return wrapContent(formatter(params) + actionsPlaceholder);
        }

        if (!tooltipParamsRef.current) {
          return wrapContent('\u2014');
        }

        // If the tooltip is frozen, use the cached tooltip params and
        // return the formatted content, including the tooltip actions.
        const p = tooltipParamsRef.current;
        const value = (Array.isArray(p) ? p[0]?.name : p.name) ?? '';
        return wrapContent(formatter(p) + (actionsHtmlRenderer?.(value) ?? ''));
      },
      position(
        point: [number, number],
        _params: TooltipComponentFormatterCallbackParams,
        el: any
      ) {
        const dom = el as HTMLDivElement;
        const tooltipWidth = dom?.offsetWidth ?? 0;
        const [rawX = 0, rawY = 0] = frozenPosition ?? point;

        let x = rawX + TOOLTIP_POSITION_X_OFFSET;
        const y = rawY + TOOLTIP_POSITION_Y_OFFSET;

        // Flip left if it overflows chart width. Mitigates the content from being cut off.
        if (x + tooltipWidth > chartWidth) {
          x = rawX - tooltipWidth - TOOLTIP_POSITION_X_OFFSET;
        }

        return [x, y];
      },
    }),
    [frozenPosition, chartWidth, formatter, actionsHtmlRenderer, tooltipParamsRef]
  );

  return tooltipConfig;
}
