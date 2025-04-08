import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function UserHealthCountChart() {
  const {series, isPending, error} = useUserHealthBreakdown({type: 'count'});

  const aliases = {
    healthy_user_count: 'count_healthy(user)',
    crashed_user_count: 'count_crashed(user)',
    errored_user_count: 'count_errored(user)',
    abnormal_user_count: 'count_abnormal(user)',
  };

  return (
    <InsightsLineChartWidget
      title={CHART_TITLES.UserHealthCountChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.UserHealthCountChart} />
      )}
      height={SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'Breakdown of total [linkUsers:users], grouped by [linkStatus:health status].',
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
        healthy_user_count: false,
      }}
    />
  );
}
