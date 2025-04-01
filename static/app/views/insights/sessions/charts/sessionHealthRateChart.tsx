import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';
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
      title={t('Session Health')}
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
        [aliases.healthy_session_rate]: false,
      }}
    />
  );
}
