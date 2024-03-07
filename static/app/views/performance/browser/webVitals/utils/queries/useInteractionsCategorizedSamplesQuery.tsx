import {
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useInpSpanSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useInpSpanSamplesWebVitalsQuery';
import type {InteractionSpanSampleRowWithScore} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  enabled: boolean;
  transaction: string;
};

export function useInteractionsCategorizedSamplesQuery({transaction, enabled}: Props) {
  const {data: goodData, isFetching: isGoodDataLoading} = useInpSpanSamplesWebVitalsQuery(
    {
      transaction,
      enabled,
      limit: 3,
      filters: {
        'measurements.inp': `<${PERFORMANCE_SCORE_P90S.inp}`,
      },
    }
  );
  const {data: mehData, isFetching: isMehDataLoading} = useInpSpanSamplesWebVitalsQuery({
    transaction,
    enabled,
    limit: 3,
    filters: {
      'measurements.inp': [
        `>=${PERFORMANCE_SCORE_P90S.inp}`,
        `<${PERFORMANCE_SCORE_MEDIANS.inp}`,
      ],
    },
  });
  const {data: poorData, isFetching: isBadDataLoading} = useInpSpanSamplesWebVitalsQuery({
    transaction,
    enabled,
    limit: 3,
    filters: {
      'measurements.inp': `>=${PERFORMANCE_SCORE_MEDIANS.inp}`,
    },
  });

  const data = [...goodData, ...mehData, ...poorData];

  const isLoading = isGoodDataLoading || isMehDataLoading || isBadDataLoading;

  const interactionsTableData: InteractionSpanSampleRowWithScore[] = data.sort(
    (a, b) => a.inpScore - b.inpScore
  );

  return {
    data: interactionsTableData,
    isLoading,
  };
}
