import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import {useInsightChartRenderer} from 'sentry/views/insights/sessions/components/insightLayoutContext';

export const MISSING_CONTEXT_PROVIDER = -1;

const Context = createContext<{
  index: number;
}>({
  index: MISSING_CONTEXT_PROVIDER,
});

interface Props {
  index: number;
}

export function ChartPlacementContext({index}: Props) {
  const renderer = useInsightChartRenderer({index});
  if (renderer) {
    return <Context value={{index}}>{renderer()}</Context>;
  }

  // There might not be a renderer if the names of options have changed, and
  // localStorage contains an unknown value, for example.
  return (
    <Context value={{index}}>
      <Widget Title={<ChartSelectionTitle title={t('None')} />} />
    </Context>
  );
}

export function useChartPlacementContext() {
  return useContext(Context);
}
