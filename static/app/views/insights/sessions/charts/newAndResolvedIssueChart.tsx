import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import ChartWithIssues from 'sentry/views/insights/sessions/charts/chartWithIssues';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useNewAndResolvedIssues from 'sentry/views/insights/sessions/queries/useNewAndResolvedIssues';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';

export default function NewAndResolvedIssueChart({project}: {project: Project}) {
  const {series, isPending, error} = useNewAndResolvedIssues({type: 'issue'});
  const theme = useTheme();

  const aliases = {
    new_issues_count: 'new_issues',
    resolved_issues_count: 'resolved_issues',
  };

  const colorPalette = theme.chart.getColorPalette(series.length - 2);

  const plottables = series.map(
    (ts, index) =>
      new Bars(convertSeriesToTimeseries(ts), {
        alias: aliases[ts.seriesName as keyof typeof aliases],
        color: colorPalette[index],
      })
  );

  return (
    <ChartWithIssues
      title={CHART_TITLES.NewAndResolvedIssueChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.NewAndResolvedIssueChart} />
      )}
      project={project}
      series={series}
      description={t('New and resolved issue counts over time.')}
      plottables={plottables}
      isPending={isPending}
      error={error}
    />
  );
}
