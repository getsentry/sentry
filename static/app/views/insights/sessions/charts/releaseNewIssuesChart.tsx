import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import ChartWithIssues from 'sentry/views/insights/sessions/charts/chartWithIssues';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useReleaseNewIssues from 'sentry/views/insights/sessions/queries/useReleaseNewIssues';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';

export default function ReleaseNewIssuesChart({project}: {project: Project}) {
  const {series, isPending, error} = useReleaseNewIssues();
  const theme = useTheme();

  const colorPalette = theme.chart.getColorPalette(series.length - 2);
  const plottables = series.map(
    (ts, index) =>
      new Bars(convertSeriesToTimeseries(ts), {
        alias: ts.seriesName,
        color: colorPalette[index],
        stack: 'all',
      })
  );

  return (
    <ChartWithIssues
      title={CHART_TITLES.ReleaseNewIssuesChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.ReleaseNewIssuesChart} />
      )}
      project={project}
      series={series}
      description={t(
        `New issue counts over time, grouped by release. The 5 most recent releases are shown, and the rest are grouped into 'other'.`
      )}
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
