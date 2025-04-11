import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function SessionHealthCountChart() {
  const {series, isPending, error} = useSessionHealthBreakdown({type: 'count'});

  const aliases = {
    healthy_session_count: 'count_healthy(session)',
    crashed_session_count: 'count_crashed(session)',
    errored_session_count: 'count_errored(session)',
    abnormal_session_count: 'count_abnormal(session)',
  };

  return (
    <InsightsLineChartWidget
      title={CHART_TITLES.SessionHealthCountChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.SessionHealthCountChart} />
      )}
      height={SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The count of sessions with each health status. See [link:session status].',
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
      legendSelection={{
        healthy_session_count: false,
      }}
    />
  );
}
