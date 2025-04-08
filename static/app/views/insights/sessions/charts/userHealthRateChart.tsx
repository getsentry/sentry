import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function UserHealthRateChart() {
  const {series, isPending, error} = useUserHealthBreakdown({type: 'rate'});

  const aliases = {
    healthy_user_rate: 'rate_healthy(user)',
    crashed_user_rate: 'rate_crashed(user)',
    errored_user_rate: 'rate_errored(user)',
    abnormal_user_rate: 'rate_abnormal(user)',
  };

  return (
    <InsightsAreaChartWidget
      title={CHART_TITLES.UserHealthRateChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.UserHealthRateChart} />
      )}
      height={SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of [linkUsers:users] with each [linkStatus:health status].',
        {
          linkUsers: (
            <ExternalLink href="https://docs.sentry.io/product/releases/health/#user-modeapplication-mode-sessions" />
          ),
          linkStatus: (
            <ExternalLink href="https://docs.sentry.io/product/releases/health/#session-status" />
          ),
        }
      )}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
      legendSelection={{
        healthy_user_rate: false,
      }}
    />
  );
}
