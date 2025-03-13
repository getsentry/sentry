import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';

export default function SessionHealthCountChart({view}: {view: string}) {
  const {series, isPending, error} = useSessionHealthBreakdown({type: 'count'});
  const frontendPath = view === FRONTEND_LANDING_SUB_PATH;

  const aliases = {
    healthy_session_count: t('Healthy session count'),
    crashed_session_count: frontendPath
      ? t('Unhandled error session count')
      : t('Crashed session count'),
    errored_session_count: frontendPath
      ? t('Handled error session count')
      : t('Errored session count'),
    abnormal_session_count: t('Abnormal session count'),
  };

  return (
    <InsightsLineChartWidget
      title={t('Sessions')}
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
    />
  );
}
