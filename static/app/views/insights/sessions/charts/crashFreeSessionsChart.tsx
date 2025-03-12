import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useCrashFreeSessions from 'sentry/views/insights/sessions/queries/useCrashFreeSessions';

export default function CrashFreeSessionsChart() {
  const {series, releases, isPending, error} = useCrashFreeSessions();

  const aliases = Object.fromEntries(
    releases?.map(release => [`crash_free_session_rate_${release}`, release]) ?? []
  );

  return (
    <InsightsLineChartWidget
      title={t('Crash Free Sessions')}
      description={t('Percent of healthy sessions out of total sessions.')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
