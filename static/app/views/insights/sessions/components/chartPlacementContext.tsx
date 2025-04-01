import {createContext, useContext} from 'react';

import {useInsightChartRenderer} from 'sentry/views/insights/sessions/components/insightLayoutContext';

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
  const renderer = useInsightChartRenderer({index});
  return <Context value={{index}}>{renderer?.()}</Context>;
}

export function useChartPlacementContext(): TContext {
  return useContext(Context);
}
