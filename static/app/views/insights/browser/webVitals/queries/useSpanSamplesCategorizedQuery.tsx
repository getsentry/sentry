import {defined} from 'sentry/utils';
import {
  CLS_SPANS_FILTER,
  INTERACTION_SPANS_FILTER,
  LCP_SPANS_FILTER,
  SPANS_FILTER,
  useSpanSamplesWebVitalsQuery,
} from 'sentry/views/insights/browser/webVitals/queries/useSpanSamplesWebVitalsQuery';
import type {
  SpanSampleRowWithScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
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
  webVital: WebVitals | null;
};

export function useSpanSamplesCategorizedQuery({
  transaction,
  enabled,
  browserTypes,
  subregions,
  webVital,
}: Props) {
  const webVitalFilter =
    webVital === 'inp'
      ? INTERACTION_SPANS_FILTER
      : webVital === 'lcp'
        ? LCP_SPANS_FILTER
        : webVital === 'cls'
          ? CLS_SPANS_FILTER
          : SPANS_FILTER;
  const {data: goodData, isFetching: isGoodDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled: enabled && defined(webVital),
    limit: 3,
    filter: defined(webVital)
      ? `measurements.${webVital}:<${PERFORMANCE_SCORE_P90S[webVital]} ${webVitalFilter}`
      : undefined,
    browserTypes,
    subregions,
    webVital: webVital ?? undefined,
  });
  const {data: mehData, isFetching: isMehDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled: enabled && defined(webVital),
    limit: 3,
    filter: defined(webVital)
      ? `measurements.${webVital}:>=${PERFORMANCE_SCORE_P90S[webVital]} measurements.${webVital}:<${PERFORMANCE_SCORE_MEDIANS[webVital]} ${webVitalFilter}`
      : undefined,
    browserTypes,
    subregions,
    webVital: webVital ?? undefined,
  });
  const {data: poorData, isFetching: isBadDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled: enabled && defined(webVital),
    limit: 3,
    filter: defined(webVital)
      ? `measurements.${webVital}:>=${PERFORMANCE_SCORE_MEDIANS[webVital]} ${webVitalFilter}`
      : undefined,
    browserTypes,
    subregions,
    webVital: webVital ?? undefined,
  });

  const data = [...goodData, ...mehData, ...poorData];

  const isLoading = isGoodDataLoading || isMehDataLoading || isBadDataLoading;

  const spanSamplesTableData: SpanSampleRowWithScore[] = data.sort(
    (a, b) => a.totalScore - b.totalScore
  );

  return {
    data: spanSamplesTableData,
    isLoading,
  };
}
