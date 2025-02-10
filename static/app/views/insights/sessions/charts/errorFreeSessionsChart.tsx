import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useErrorFreeSessions from 'sentry/views/insights/sessions/queries/useErrorFreeSessions';

interface Props {
  groupByRelease?: boolean;
}

export default function ErrorFreeSessionsChart({groupByRelease}: Props) {
  const {seriesData, mobileSeriesData, releases, isPending, error} = useErrorFreeSessions(
    {
      groupByRelease,
    }
  );

  const mobileSeries =
    mobileSeriesData?.map((series, index) => ({
      data: series,
      seriesName: `successful_session_rate_${releases[index]}`,
      meta: {
        fields: {
          [`successful_session_rate_${releases[index]}`]: 'percentage' as const,
          time: 'date' as const,
        },
        units: {
          [`successful_session_rate_${releases[index]}`]: '%',
        },
      },
    })) ?? [];

  if (groupByRelease) {
    return (
      <InsightsLineChartWidget
        title={t('Error Free Session Rate')}
        aliases={Object.fromEntries(
          releases?.map(release => [`successful_session_rate_${release}`, release]) ?? []
        )}
        series={mobileSeries}
        isLoading={isPending}
        error={error}
      />
    );
  }

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
