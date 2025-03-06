import {t} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import useUserHealthBreakdown from 'sentry/views/insights/sessions/queries/useUserHealthBreakdown';

export default function UserHealthRateChart() {
  const {series, isPending, error} = useUserHealthBreakdown({
    type: 'rate',
  });

  const aliases = {
    healthy_user_rate: t('Healthy user rate'),
    crashed_user_rate: t('Crashed user rate'),
    errored_user_rate: t('Errored user rate'),
    abnormal_user_rate: t('Abnormal user rate'),
  };

  return (
    <InsightsAreaChartWidget
      title={t('User Health Rate')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
