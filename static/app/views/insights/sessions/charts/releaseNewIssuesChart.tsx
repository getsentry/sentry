import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import {CHART_TITLES} from 'sentry/views/insights/sessions/components/settings';
import useReleaseNewIssues from 'sentry/views/insights/sessions/queries/useReleaseNewIssues';

export default function ReleaseNewIssuesChart() {
  const {series, isPending, error} = useReleaseNewIssues();

  return (
    <InsightsLineChartWidget
      title={CHART_TITLES.ReleaseNewIssuesChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.ReleaseNewIssuesChart} />
      )}
      description={t('New issue counts over time, grouped by release.')}
      series={series}
      isLoading={isPending}
      legendSelection={{
        // disable the 'other' series by default since its large values can cause the other lines to be insignificant
        other: false,
      }}
      error={error}
    />
  );
}
