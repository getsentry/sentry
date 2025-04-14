import {createContext, useCallback, useContext} from 'react';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  CHART_MAP,
  CHART_RENAMES,
  DEFAULT_LAYOUTS,
  PAGE_CHART_OPTIONS,
} from 'sentry/views/insights/sessions/components/chartMap';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';

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

// TODO: this could be based on the values in CHART_MAP somehow... idk how to express that.
type ChartProps = {project: Project};

interface Props {
  chartProps: ChartProps;
  index: number;
  view: DomainView;
}

export function ChartPlacementSlot({view, index, chartProps}: Props) {
  const organization = useOrganization();

  const [chartsByIndex, setChartsByIndex] = useSyncedLocalStorageState<
    (typeof DEFAULT_LAYOUTS)[DomainView]
  >(`insights-sessions-layout-${organization.slug}-${view}`, DEFAULT_LAYOUTS[view]);

  const chartOptions = PAGE_CHART_OPTIONS[view].map(opt => ({
    value: opt,
    label: CHART_TITLES[opt],
    disabled: chartsByIndex.includes(opt),
  }));

  const onChange = useCallback(
    (selection: Option) => {
      const updated = chartsByIndex.toSpliced(index, 1, selection.value);
      setChartsByIndex(updated);
    },
    [chartsByIndex, index, setChartsByIndex]
  );

  const chartName = CHART_RENAMES[chartsByIndex[index] as string] ?? chartsByIndex[index];
  const Chart = chartName && CHART_MAP[chartName];
  if (Chart) {
    return (
      <Context value={{chartName, chartOptions, onChange}}>
        <Chart {...chartProps} />
      </Context>
    );
  }

  // There might not be a renderer if the names of options have changed and
  // localStorage contains an unknown value.
  return (
    <Context value={{chartName, chartOptions, onChange}}>
      <Widget Title={<ChartSelectionTitle title={t('None')} />} />
    </Context>
  );
}

export function useChartPlacementContext() {
  return useContext(Context);
}
