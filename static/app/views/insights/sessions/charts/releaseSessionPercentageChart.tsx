import {t} from 'sentry/locale';
import {formatSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatSeriesName';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import {CHART_TITLES} from 'sentry/views/insights/sessions/components/settings';
import useReleaseSessionPercentage from 'sentry/views/insights/sessions/queries/useReleaseSessionPercentage';

export default function ReleaseSessionPercentageChart() {
  const {series, releases, isPending, error} = useReleaseSessionPercentage();

  const aliases = Object.fromEntries(
    releases?.map(release => [`${release}_session_percent`, formatSeriesName(release)]) ??
      []
  );

  return (
    <InsightsAreaChartWidget
      title={CHART_TITLES.ReleaseSessionPercentageChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.ReleaseSessionPercentageChart} />
      )}
      description={t(
        'The percentage of total sessions that each release accounted for. The 5 most recent releases are shown.'
      )}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
