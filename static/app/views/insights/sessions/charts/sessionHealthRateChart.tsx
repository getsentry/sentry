import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function SessionHealthRateChart() {
  const {series, isPending, error} = useSessionHealthBreakdown({type: 'rate'});

  const aliases = {
    healthy_session_rate: 'rate_healthy(session)',
    crashed_session_rate: 'rate_crashed(session)',
    errored_session_rate: 'rate_errored(session)',
    abnormal_session_rate: 'rate_abnormal(session)',
  };

  return (
    <InsightsAreaChartWidget
      title={CHART_TITLES.SessionHealthRateChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.SessionHealthRateChart} />
      )}
      height={SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of sessions with each health status. See [link:session status].',
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
        healthy_session_rate: false,
      }}
    />
  );
}
