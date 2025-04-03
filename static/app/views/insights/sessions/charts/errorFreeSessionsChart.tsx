import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useErrorFreeSessions from 'sentry/views/insights/sessions/queries/useErrorFreeSessions';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function ErrorFreeSessionsChart() {
  const {series, isPending, error} = useErrorFreeSessions();

  const aliases = {
    successful_session_rate: t('crash_free_rate(session)'),
  };

  return (
    <InsightsLineChartWidget
      title={CHART_TITLES.ErrorFreeSessionsChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.ErrorFreeSessionsChart} />
      )}
      height={SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of sessions terminating without a single error occurring. See [link:session status].',
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
