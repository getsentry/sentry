import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useReleaseSessionCounts from 'sentry/views/insights/sessions/queries/useReleaseSessionCounts';

export default function ReleaseSessionCountChart() {
  const {series, releases, isPending, error} = useReleaseSessionCounts();

  const aliases = Object.fromEntries(
    releases?.map(release => [`${release}_total_sessions`, release]) ?? []
  );

  return (
    <InsightsLineChartWidget
      title={t('Total Sessions by Release')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
