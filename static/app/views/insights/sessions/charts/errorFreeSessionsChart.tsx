import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useErrorFreeSessions from 'sentry/views/insights/sessions/queries/useErrorFreeSessions';

export default function ErrorFreeSessionsChart() {
  const {series, isPending, error} = useErrorFreeSessions();

  const aliases = {
    successful_session_rate: t('Error free session rate'),
  };

  return (
    <InsightsLineChartWidget
      title={t('Error Free Sessions')}
      description={t('Percent of healthy sessions out of total sessions.')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
