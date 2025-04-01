import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import ChartWithIssues from 'sentry/views/insights/sessions/charts/chartWithIssues';
import useNewAndResolvedIssues from 'sentry/views/insights/sessions/queries/useNewAndResolvedIssues';

export default function NewAndResolvedIssueChart({
  type,
  project,
}: {
  project: Project;
  type: 'issue' | 'feedback';
}) {
  const {series, isPending, error} = useNewAndResolvedIssues({type});
  const theme = useTheme();

  const aliases = {
    new_issues_count: `new_${type}s`,
    resolved_issues_count: `resolved_${type}s`,
  };

  const colorPalette = theme.chart.getColorPalette(series.length - 2);
  const title = type === 'issue' ? t('Issues') : t('User Feedback');
  const plottables = series.map(
    (ts, index) =>
      new Bars(convertSeriesToTimeseries(ts), {
        alias: aliases[ts.seriesName as keyof typeof aliases],
        color: colorPalette[index],
      })
  );

  return (
    <ChartWithIssues
      project={project}
      series={series}
      title={title}
      description={t('New and resolved %s counts over time.', type)}
      plottables={plottables}
      isPending={isPending}
      error={error}
    />
  );
}
