import {t} from 'sentry/locale';
import {formatSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatSeriesName';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useReleaseSessionCounts from 'sentry/views/insights/sessions/queries/useReleaseSessionCounts';

export default function ReleaseSessionCountChart() {
  const {series, releases, isPending, error} = useReleaseSessionCounts();

  const aliases = Object.fromEntries(
    releases?.map(release => [`${release}_total_sessions`, formatSeriesName(release)]) ??
      []
  );

  return (
    <InsightsLineChartWidget
      title={t('Total Sessions by Release')}
      height={400}
      description={t(
        'The total number of sessions per release. The 5 most recent releases are shown.'
      )}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
