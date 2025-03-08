import {t} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import useReleaseSessionPercentage from 'sentry/views/insights/sessions/queries/useReleaseSessionPercentage';

export default function ReleaseSessionPercentageChart() {
  const {series, releases, isPending, error} = useReleaseSessionPercentage();

  const aliases = Object.fromEntries(
    releases?.map(release => [`${release}_session_percent`, release]) ?? []
  );

  return (
    <InsightsAreaChartWidget
      title={t('Percent Sessions by Release')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
