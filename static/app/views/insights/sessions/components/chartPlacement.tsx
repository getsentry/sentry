import {createContext, useContext} from 'react';

import type {CHART_MAP} from 'sentry/views/insights/sessions/components/chartMap';

type TChart = keyof typeof CHART_MAP;
type Option = {label: string; value: TChart};

const Context = createContext<{
  chartName: undefined | TChart;
  chartOptions: Option[];
  onChange: (chart: Option) => void;
}>({
  chartOptions: [],
  chartName: undefined,
  onChange: () => {},
});

export function useChartPlacementContext() {
  return useContext(Context);
}
