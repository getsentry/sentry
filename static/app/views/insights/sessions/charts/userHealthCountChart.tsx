import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';

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
      title={t('User Counts')}
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
        [aliases.healthy_user_count]: false,
      }}
    />
  );
}
