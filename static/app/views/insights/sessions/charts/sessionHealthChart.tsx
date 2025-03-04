import {t} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';

export default function SessionHealthChart() {
  const {series, isPending, error} = useSessionHealthBreakdown();

  const aliases = {
    healthy_session_rate: t('Healthy session rate'),
    crashed_session_rate: t('Crashed session rate'),
    errored_session_rate: t('Errored session rate'),
    abnormal_session_rate: t('Abnormal session rate'),
  };

  return (
    <InsightsAreaChartWidget
      title={t('Session Health Rate')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
