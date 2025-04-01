import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useEffect, useState} from 'react';

import localStorage from 'sentry/utils/localStorage';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  type CHART_MAP,
  DEFAULT_LAYOUTS,
  PAGE_CHART_OPTIONS,
} from 'sentry/views/insights/sessions/components/settings';

type TChart = keyof typeof CHART_MAP;
type TCharts = readonly TChart[];
interface TContext {
  chartOptions: TCharts;
  chartsByIndex: TCharts;
  onChange: (index: number, chart: TChart) => void;
  view: DomainView;
}

const defaultContext: TContext = {
  chartOptions: [],
  chartsByIndex: [],
  onChange: () => {},
  view: 'frontend',
};

const Context = createContext<TContext>(defaultContext);

interface Props {
  children: ReactNode;
  view: DomainView;
}

const localStorageKey = 'insights-sessions-layout';
const getLocalStorage = () => {
  return JSON.parse(localStorage.getItem(localStorageKey) || '{}');
};

export function InsightLayoutContext({children, view}: Props) {
  const chartOptions = PAGE_CHART_OPTIONS[view];

  const [chartsByIndex, setChartsByIndex] = useState<TCharts>(() => {
    return [...DEFAULT_LAYOUTS[view], ...(getLocalStorage()[view] ?? [])];
  });

  useEffect(() => {
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({
        ...getLocalStorage(),
        [view]: chartsByIndex,
      })
    );
  }, [chartsByIndex, view]);

  const onChange = useCallback((index: number, chart: TChart) => {
    setChartsByIndex(prev => prev.toSpliced(index, 1, chart));
  }, []);

  return (
    <Context value={{view, chartsByIndex, chartOptions, onChange}}>{children}</Context>
  );
}

export function useInsightLayoutContext(): TContext {
  return useContext(Context);
}
