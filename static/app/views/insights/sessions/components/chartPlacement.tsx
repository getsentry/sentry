import {createContext, useCallback, useContext, useMemo} from 'react';

import {t} from 'sentry/locale';
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

interface Props {
  index: number;
  view: DomainView;
}

export function ChartPlacementSlot({view, index}: Props) {
  const organization = useOrganization();

  const [chartsByIndexAnyName, setChartsByIndex] = useSyncedLocalStorageState<
    (typeof DEFAULT_LAYOUTS)[DomainView]
  >(`insights-sessions-layout-${organization.slug}-${view}`, DEFAULT_LAYOUTS[view]);

  const chartsByIndex = useMemo(() => {
    return chartsByIndexAnyName.map(name => {
      // This is a proper chart name, we can just use it
      if (name && PAGE_CHART_OPTIONS[view].includes(name)) {
        return name;
      }
      // The chart was renamed, use the new name
      if (name && CHART_RENAMES[name]) {
        return CHART_RENAMES[name];
      }
      // The name wasn't found, so use the default if the index is valid.
      // If `index` is invalid then we'll see the 'None' chart and the dropdown
      // will still work to pick another
      // This might cause the chart to be rendered twice on the screen
      return PAGE_CHART_OPTIONS[view][index];
    });
  }, [chartsByIndexAnyName, index, view]);

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

  const chartName = chartsByIndex[index];
  const Chart = chartName && CHART_MAP[chartName];
  if (Chart) {
    return (
      <Context value={{chartName, chartOptions, onChange}}>
        <Chart />
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
