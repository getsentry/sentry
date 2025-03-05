import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';

export default function SessionHealthCountChart() {
  const {series, isPending, error} = useSessionHealthBreakdown({type: 'count'});

  const aliases = {
    healthy_session_count: t('Healthy session count'),
    crashed_session_count: t('Crashed session count'),
    errored_session_count: t('Errored session count'),
    abnormal_session_count: t('Abnormal session count'),
  };

  return (
    <InsightsLineChartWidget
      title={t('Session Health Count')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
