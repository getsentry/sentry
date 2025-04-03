import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {formatSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatSeriesName';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useCrashFreeSessions from 'sentry/views/insights/sessions/queries/useCrashFreeSessions';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function CrashFreeSessionsChart() {
  const {series, releases, isPending, error} = useCrashFreeSessions();

  const aliases = Object.fromEntries(
    releases?.map(release => [
      `crash_free_session_rate_${release}`,
      formatSeriesName(release),
    ]) ?? []
  );

  return (
    <InsightsLineChartWidget
      title={t('Crash Free Sessions')}
      height={SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of sessions terminating without a crash. See [link:session status].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/releases/health/#session-status" />
          ),
        }
      )}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
