import type {
  DataZoomComponentOption,
  ToolboxComponentOption,
  XAXisComponentOption,
} from 'echarts';

import type {DateTimeUpdate} from 'sentry/components/charts/useChartZoom';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import type {DateString} from 'sentry/types/core';
import type {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartFinishedHandler,
  EChartRestoreHandler,
} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';

type ZoomPropKeys =
  | 'period'
  | 'xAxis'
  | 'onChartReady'
  | 'onDataZoom'
  | 'onRestore'
  | 'onFinished';

export interface ZoomRenderProps extends Pick<Props, ZoomPropKeys> {
  dataZoom?: DataZoomComponentOption[];
  end?: Date;
  isGroupedByDate?: boolean;
  showTimeInTooltip?: boolean;
  start?: Date;
  toolBox?: ToolboxComponentOption;
  utc?: boolean;
}

type Props = {
  children: (props: ZoomRenderProps) => React.ReactNode;
  disabled?: boolean;
  end?: DateString;
  onChartReady?: EChartChartReadyHandler;
  onDataZoom?: EChartDataZoomHandler;
  onFinished?: EChartFinishedHandler;
  onRestore?: EChartRestoreHandler;
  onZoom?: (period: DateTimeUpdate) => void;
  period?: string | null;
  router?: InjectedRouter;
  saveOnZoom?: boolean;
  start?: DateString;
  usePageDate?: boolean;
  utc?: boolean | null;
  xAxis?: XAXisComponentOption;
  xAxisIndex?: number | number[];
};

/**
 * This is a very opinionated component that takes a render prop through `children`. It
 * will provide props to be passed to `BaseChart` to enable support of zooming without
 * eCharts' clunky zoom toolboxes.
 *
 * This also is very tightly coupled with the Global Selection Header. We can make it more
 * generic if need be in the future.
 */
function ChartZoom(props: Props) {
  const {children, onZoom, usePageDate, saveOnZoom, xAxisIndex} = props;
  const chartZoomProps = useChartZoom({onZoom, usePageDate, saveOnZoom, xAxisIndex});
  return children(chartZoomProps);
}

export default ChartZoom;
