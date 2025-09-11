import MiniBarChart from 'sentry/components/charts/miniBarChart';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useApiQuery} from 'sentry/utils/queryClient';

type Props = {
  label: string;
  resolution: string;
  since: number;
  stat: string;
  height?: number;
};

function InternalStatChart({label, height, since, resolution, stat}: Props) {
  const {data, isLoading, isError, refetch} = useApiQuery<Array<[number, number]>>(
    [
      '/internal/stats/',
      {
        query: {
          since,
          resolution,
          key: stat,
        },
      },
    ],
    {staleTime: 0}
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const series = {
    seriesName: label,
    data:
      data?.map(([timestamp, value]) => ({
        name: timestamp * 1000,
        value,
      })) ?? [],
  };
  return (
    <MiniBarChart
      height={height ?? 150}
      series={[series]}
      isGroupedByDate
      showTimeInTooltip
      labelYAxisExtents
    />
  );
}

export default InternalStatChart;
