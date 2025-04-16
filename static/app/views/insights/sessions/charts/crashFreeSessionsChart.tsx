import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {formatSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatSeriesName';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useCrashFreeSessions from 'sentry/views/insights/sessions/queries/useCrashFreeSessions';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
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
      title={CHART_TITLES.CrashFreeSessionsChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.CrashFreeSessionsChart} />
      )}
      height={SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of sessions terminating without a crash. See [link:session status]. The 5 most adopted releases are shown.',
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
