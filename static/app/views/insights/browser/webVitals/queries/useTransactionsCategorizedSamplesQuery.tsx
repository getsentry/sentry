import {useTransactionSamplesWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useTransactionSamplesWebVitalsScoresQuery';
import type {
  TransactionSampleRowWithScore,
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

export function useTransactionsCategorizedSamplesQuery({
  transaction,
  webVital,
  enabled,
  browserTypes,
  subregions,
}: Props) {
  const {data: goodData, isLoading: isGoodTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsScoresQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:<${PERFORMANCE_SCORE_P90S[webVital]}`
        : undefined,
      enabled,
      withProfiles: true,
      sortName: 'webVitalSort',
      webVital: webVital ?? undefined,
      browserTypes,
      subregions,
    });

  const {data: mehData, isLoading: isMehTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsScoresQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:<${PERFORMANCE_SCORE_MEDIANS[webVital]} measurements.${webVital}:>=${PERFORMANCE_SCORE_P90S[webVital]}`
        : undefined,
      enabled,
      withProfiles: true,
      sortName: 'webVitalSort',
      webVital: webVital ?? undefined,
      browserTypes,
      subregions,
    });

  const {data: poorData, isLoading: isPoorTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsScoresQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:>=${PERFORMANCE_SCORE_MEDIANS[webVital]}`
        : undefined,
      enabled,
      withProfiles: true,
      sortName: 'webVitalSort',
      webVital: webVital ?? undefined,
      browserTypes,
      subregions,
    });

  const data = [...goodData, ...mehData, ...poorData];

  const isTransactionWebVitalsQueryLoading =
    isGoodTransactionWebVitalsQueryLoading ||
    isMehTransactionWebVitalsQueryLoading ||
    isPoorTransactionWebVitalsQueryLoading;

  const transactionsTableData: TransactionSampleRowWithScore[] = data.sort(
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    (a, b) => a[`${webVital}Score`] - b[`${webVital}Score`]
  );

  return {
    data: transactionsTableData,
    isLoading: isTransactionWebVitalsQueryLoading,
  };
}
