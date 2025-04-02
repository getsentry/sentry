import type {ReactNode} from 'react';
import {createContext, useCallback, useContext} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  CHART_MAP,
  CHART_TITLES,
  DEFAULT_LAYOUTS,
  PAGE_CHART_OPTIONS,
} from 'sentry/views/insights/sessions/components/settings';

type TChart = keyof typeof CHART_MAP;
type Option = {label: string; value: TChart};

const Context = createContext<{
  chartOptions: Option[];
  chartsByIndex: readonly TChart[];
  onChange: (index: number, chart: Option) => void;
}>({
  chartOptions: [],
  chartsByIndex: [],
  onChange: () => {},
});

interface Props {
  children: ReactNode;
  view: DomainView;
}

export function InsightLayoutContext({children, view}: Props) {
  const organization = useOrganization();

  const [chartsByIndex, setChartsByIndex] = useLocalStorageState<
    (typeof DEFAULT_LAYOUTS)[DomainView]
  >(`insights-sessions-layout-${organization.slug}-${view}`, DEFAULT_LAYOUTS[view]);

  const chartOptions = PAGE_CHART_OPTIONS[view].map(opt => ({
    value: opt,
    label: CHART_TITLES[opt],
    disabled: chartsByIndex.includes(opt),
  }));

  const onChange = useCallback(
    (index: number, selection: Option) => {
      setChartsByIndex(prev => prev.toSpliced(index, 1, selection.value));
    },
    [setChartsByIndex]
  );

  return <Context value={{chartsByIndex, chartOptions, onChange}}>{children}</Context>;
}

export function useInsightLayoutContext() {
  return useContext(Context);
}

export function useInsightChartRenderer({index}: {index: number}) {
  const {chartsByIndex} = useInsightLayoutContext();
  const key = chartsByIndex[index];
  if (!key) {
    return null;
  }
  const renderer = CHART_MAP[key];
  return renderer;
}
