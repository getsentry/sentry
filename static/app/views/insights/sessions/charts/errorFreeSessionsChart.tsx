import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useErrorFreeSessions from 'sentry/views/insights/sessions/queries/useErrorFreeSessions';

export default function ErrorFreeSessionsChart() {
  const {seriesData, isPending, error} = useErrorFreeSessions();

  return (
    <InsightsLineChartWidget
      title={t('Error Free Session Rate')}
      aliases={{
        successful_session_rate: t('Error free session rate'),
      }}
      series={[
        {
          data: seriesData,
          seriesName: 'successful_session_rate',
          meta: {
            fields: {
              successful_session_rate: 'percentage',
              time: 'date',
            },
            units: {
              successful_session_rate: '%',
            },
          },
        },
      ]}
      isLoading={isPending}
      error={error}
    />
  );
}
