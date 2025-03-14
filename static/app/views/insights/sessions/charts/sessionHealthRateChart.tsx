import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';

export default function SessionHealthRateChart({view}: {view: string}) {
  const {series, isPending, error} = useSessionHealthBreakdown({type: 'rate'});
  const frontendPath = view === FRONTEND_LANDING_SUB_PATH;

  const aliases = {
    healthy_session_rate: t('Healthy session rate'),
    crashed_session_rate: frontendPath
      ? t('Unhandled error session rate')
      : t('Crashed session rate'),
    errored_session_rate: frontendPath
      ? t('Handled error session rate')
      : t('Errored session rate'),
    abnormal_session_rate: t('Abnormal session rate'),
  };

  return (
    <InsightsAreaChartWidget
      title={t('Session Health')}
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
    />
  );
}
