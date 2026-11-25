import {defined} from 'sentry/utils/defined';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import type {SubregionCode} from 'sentry/views/insights/types';

import {
  CLS_SPANS_FILTER,
  INTERACTION_SPANS_FILTER,
  LCP_SPANS_FILTER,
  SPANS_FILTER,
  useSpanSamplesWebVitalsQuery,
} from './useSpanSamplesWebVitalsQuery';

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
  // Bucket by the score Relay stored, not the raw value: Relay scores each
  // browser on its own curve, so one raw cutoff can't fit desktop and mobile.
  const ratioField = webVital ? `measurements.score.ratio.${webVital}` : undefined;

  const {data: goodData, isFetching: isGoodDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled: enabled && defined(webVital),
    limit: 3,
    filter: ratioField ? `${ratioField}:>=0.9 ${webVitalFilter}` : undefined,
    browserTypes,
    subregions,
    webVital: webVital ?? undefined,
  });
  const {data: mehData, isFetching: isMehDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled: enabled && defined(webVital),
    limit: 3,
    filter: ratioField
      ? `${ratioField}:>=0.5 ${ratioField}:<0.9 ${webVitalFilter}`
      : undefined,
    browserTypes,
    subregions,
    webVital: webVital ?? undefined,
  });
  const {data: poorData, isFetching: isBadDataLoading} = useSpanSamplesWebVitalsQuery({
    transaction,
    enabled: enabled && defined(webVital),
    limit: 3,
    filter: ratioField
      ? `${ratioField}:>0 ${ratioField}:<0.5 ${webVitalFilter}`
      : undefined,
    browserTypes,
    subregions,
    webVital: webVital ?? undefined,
  });

  const data = [...goodData, ...mehData, ...poorData];

  const isLoading = isGoodDataLoading || isMehDataLoading || isBadDataLoading;

  const spanSamplesTableData = defined(webVital)
    ? data.sort((a, b) => a[`${webVital}Score`] - b[`${webVital}Score`])
    : data.sort((a, b) => a.totalScore - b.totalScore);

  return {data: spanSamplesTableData, isLoading};
}
