import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import ChartWithIssues from 'sentry/views/insights/sessions/charts/chartWithIssues';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useNewAndResolvedIssues from 'sentry/views/insights/sessions/queries/useNewAndResolvedIssues';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';

export default function NewAndResolvedIssueChartWidget(props: LoadableChartWidgetProps) {
  const {series, isPending, error} = useNewAndResolvedIssues({
    type: 'issue',
    pageFilters: props.pageFilters,
  });
  const theme = useTheme();

  const aliases = {
    new_issues_count: 'new_issues',
    resolved_issues_count: 'resolved_issues',
  };

  const colorPalette = theme.chart.getColorPalette(series.length - 1);

  const plottables = series.map(
    (ts, index) =>
      new Bars(convertSeriesToTimeseries(ts), {
        alias: aliases[ts.seriesName as keyof typeof aliases],
        color: colorPalette[index],
      })
  );

  return (
    <ChartWithIssues
      {...props}
      id="newAndResolvedIssueChartWidget"
      title={CHART_TITLES.NewAndResolvedIssueChartWidget}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.NewAndResolvedIssueChartWidget} />
      )}
      series={series}
      description={t('New and resolved issue counts over time.')}
      plottables={plottables}
      isPending={isPending}
      error={error}
    />
  );
}
