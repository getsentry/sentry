import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';

export default function UserHealthRateChart({view}: {view: string}) {
  const {series, isPending, error} = useUserHealthBreakdown({
    type: 'rate',
  });
  const frontendPath = view === FRONTEND_LANDING_SUB_PATH;

  const aliases = {
    healthy_user_rate: t('Healthy user rate'),
    crashed_user_rate: frontendPath
      ? t('Unhandled error user rate')
      : t('Crashed user rate'),
    errored_user_rate: frontendPath
      ? t('Handled error user rate')
      : t('Errored user rate'),
    abnormal_user_rate: t('Abnormal user rate'),
  };

  return (
    <InsightsAreaChartWidget
      title={t('User Health')}
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
    />
  );
}
