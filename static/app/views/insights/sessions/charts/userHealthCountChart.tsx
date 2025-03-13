import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';

export default function UserHealthCountChart({view}: {view: string}) {
  const {series, isPending, error} = useUserHealthBreakdown({
    type: 'count',
  });
  const frontendPath = view === FRONTEND_LANDING_SUB_PATH;

  const aliases = {
    healthy_user_count: t('Healthy user count'),
    crashed_user_count: frontendPath
      ? t('Unhandled error user count')
      : t('Crashed user count'),
    errored_user_count: frontendPath
      ? t('Handled error user count')
      : t('Errored user count'),
    abnormal_user_count: t('Abnormal user count'),
  };

  return (
    <InsightsLineChartWidget
      title={t('Users')}
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
    />
  );
}
