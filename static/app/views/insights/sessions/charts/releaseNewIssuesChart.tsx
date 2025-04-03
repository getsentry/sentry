import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import ChartWithIssues from 'sentry/views/insights/sessions/charts/chartWithIssues';
import useReleaseNewIssues from 'sentry/views/insights/sessions/queries/useReleaseNewIssues';

export default function ReleaseNewIssuesChart({project}: {project: Project}) {
  const {series, isPending, error} = useReleaseNewIssues();
  const theme = useTheme();

  const colorPalette = theme.chart.getColorPalette(series.length - 2);
  const plottables = series.map(
    (ts, index) =>
      new Line(convertSeriesToTimeseries(ts), {
        alias: ts.seriesName,
        color: colorPalette[index],
      })
  );

  return (
    <ChartWithIssues
      project={project}
      series={series}
      title={t('New Issues by Release')}
      description={t('New issue counts over time, grouped by release.')}
      isPending={isPending}
      error={error}
      legendSelection={{
        // disable the 'other' series by default since its large values can cause the other lines to be insignificant
        other: false,
      }}
      plottables={plottables}
    />
  );
}
