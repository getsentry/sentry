import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useErrorFreeSessions from 'sentry/views/insights/sessions/queries/useErrorFreeSessions';

interface Props {
  groupByRelease?: boolean;
}

export default function ErrorFreeSessionsChart({groupByRelease}: Props) {
  const {series, releases, isPending, error} = useErrorFreeSessions({
    groupByRelease,
  });

  const aliases = groupByRelease
    ? Object.fromEntries(
        releases?.map(release => [`successful_session_rate_${release}`, release]) ?? []
      )
    : {
        successful_session_rate: t('Error free session rate'),
      };

  return (
    <InsightsLineChartWidget
      title={t('Error Free Session Rate')}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
