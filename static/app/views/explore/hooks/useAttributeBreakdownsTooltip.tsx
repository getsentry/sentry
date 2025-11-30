import {useEffect, useRef, useState} from 'react';
import type {ECharts, TooltipComponentFormatterCallbackParams} from 'echarts';

import type {TooltipOption} from 'sentry/components/charts/baseChart';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  useAddSearchFilter,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';

type Params = {
  attributeName: string;
  chartRef: React.RefObject<ReactEchartsRef | null>;
  chartWidth: number;
  formatter: (params: TooltipComponentFormatterCallbackParams) => string;
  actionsHtmlRenderer?: (value: string) => string;
};

export enum Actions {
  GROUP_BY = 'group_by_attribute',
  ADD_TO_FILTER = 'add_value_to_filter',
  EXCLUDE_FROM_FILTER = 'exclude_value_from_filter',
  COPY_TO_CLIPBOARD = 'copy_value_to_clipboard',
}

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

      if (frozenPosition) {
        setFrozenPosition(null);
        tooltipParamsRef.current = null;
      } else {
        setFrozenPosition(pixelPoint);
      }
    };

    dom.addEventListener('click', handleClickAnywhere);

    // eslint-disable-next-line consistent-return
    return () => {
      dom.removeEventListener('click', handleClickAnywhere);
    };
  }, [chartRef, frozenPosition]);

  useEffect(() => {
    if (!frozenPosition) return;

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

    document.addEventListener('click', handleClickActions);

    // eslint-disable-next-line consistent-return
    return () => {
      document.removeEventListener('click', handleClickActions);
    };
  }, [frozenPosition, copyToClipboard, addSearchFilter, setGroupBys]);

  const tooltipConfig: TooltipOption = {
    trigger: 'axis',
    appendToBody: true,
    renderMode: 'html',
    enterable: true,
    formatter: (params: TooltipComponentFormatterCallbackParams) => {
      if (!frozenPosition) {
        tooltipParamsRef.current = params;
        return (
          formatter(params) +
          '<div class="tooltip-footer" style="display: flex; justify-content: center; padding: 10px;">Click for actions</div>'
        );
      }

      const value = (Array.isArray(params) ? params[0]?.name : params.name) ?? '';
      return formatter(tooltipParamsRef.current!) + actionsHtmlRenderer?.(value);
    },
    position(
      point: [number, number],
      _params: TooltipComponentFormatterCallbackParams,
      el: any
    ) {
      const dom = el as HTMLDivElement;
      const tooltipWidth = dom?.offsetWidth ?? 0;
      const [rawX = 0, rawY = 0] = frozenPosition ?? point;

      const offsetX = 20;
      let x = rawX + offsetX;
      const y = rawY;

      // flip left if it overflows chart width
      if (x + tooltipWidth > chartWidth) {
        x = rawX - tooltipWidth - offsetX;
      }

      return [x, y];
    },
  };

  return tooltipConfig;
}
