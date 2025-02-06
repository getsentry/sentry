import {
  INTERACTION_SPANS_FILTER,
  useSpanSamplesWebVitalsQuery,
} from 'sentry/views/insights/browser/webVitals/queries/useSpanSamplesWebVitalsQuery';
import type {SpanSampleRowWithScore} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
import type {SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes: BrowserType[];
  enabled: boolean;
  subregions: SubregionCode[];
  transaction: string;
};

export function useInteractionsCategorizedSamplesQuery({
  transaction,
  enabled,
  browserTypes,
  subregions,
}: Props) {
  const {data: goodData, isFetching: isGoodDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled,
    limit: 3,
    filter: `measurements.inp:<${PERFORMANCE_SCORE_P90S.inp} ${INTERACTION_SPANS_FILTER}`,
    browserTypes,
    subregions,
  });
  const {data: mehData, isFetching: isMehDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled,
    limit: 3,
    filter: `measurements.inp:>=${PERFORMANCE_SCORE_P90S.inp} measurements.inp:<${PERFORMANCE_SCORE_MEDIANS.inp} ${INTERACTION_SPANS_FILTER}`,
    browserTypes,
    subregions,
  });
  const {data: poorData, isFetching: isBadDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled,
    limit: 3,
    filter: `measurements.inp:>=${PERFORMANCE_SCORE_MEDIANS.inp} ${INTERACTION_SPANS_FILTER}`,
    browserTypes,
    subregions,
  });

  const data = [...goodData, ...mehData, ...poorData];

  const isLoading = isGoodDataLoading || isMehDataLoading || isBadDataLoading;

  const interactionsTableData: SpanSampleRowWithScore[] = data.sort(
    (a, b) => a.totalScore - b.totalScore
  );

  return {
    data: interactionsTableData,
    isLoading,
  };
}
