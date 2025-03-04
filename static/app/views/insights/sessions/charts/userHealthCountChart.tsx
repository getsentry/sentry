import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';

export default function UserHealthCountChart() {
  const {series, isPending, error} = useUserHealthBreakdown({
    type: 'count',
  });

  const aliases = {
    healthy_user_count: t('Healthy user count'),
    crashed_user_count: t('Crashed user count'),
    errored_user_count: t('Errored user count'),
    abnormal_user_count: t('Abnormal user count'),
  };

  return (
    <InsightsLineChartWidget
      title={t('User Health Count')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
