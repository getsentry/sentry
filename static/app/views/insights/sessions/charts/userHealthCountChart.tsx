import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';

export default function UserHealthCountChart({view}: {view: string}) {
  const {series, isPending, error} = useUserHealthBreakdown({type: 'count'});
  const frontendPath = view === FRONTEND_LANDING_SUB_PATH;

  const aliases = {
    healthy_user_count: t('Healthy'),
    crashed_user_count: frontendPath ? t('Unhandled error') : t('Crashed'),
    errored_user_count: frontendPath ? t('Handled error') : t('Errored'),
    abnormal_user_count: t('Abnormal'),
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
