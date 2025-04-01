import {createContext, useContext} from 'react';

import {useInsightLayoutContext} from 'sentry/views/insights/sessions/components/insightLayoutContext';
import {CHART_MAP} from 'sentry/views/insights/sessions/components/settings';

interface TContext {
  index: number;
}

const defaultContext: TContext = {
  index: 0,
};

const Context = createContext<TContext>(defaultContext);

interface Props {
  index: number;
}

export function ChartPlacementContext({index}: Props) {
  const {chartsByIndex} = useInsightLayoutContext();
  const key = chartsByIndex[index];
  if (!key) {
    return null;
  }
  const renderer = CHART_MAP[key];
  return <Context value={{index}}>{renderer?.()}</Context>;
}

export function useChartPlacementContext(): TContext {
  return useContext(Context);
}
