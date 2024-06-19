import {useInpSpanSamplesWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/queries/useInpSpanSamplesWebVitalsQuery';
import type {InteractionSpanSampleRowWithScore} from 'sentry/views/insights/browser/webVitals/types';

type Props = {
  enabled: boolean;
  transaction: string;
};

export function useGoodMehAndBadInteractionsSamplesQuery({transaction, enabled}: Props) {
  // TODO: Update this function to query good, meh, and bad interactions
  const {data, isFetching} = useInpSpanSamplesWebVitalsQuery({
    transaction,
    enabled,
    limit: 9,
  });

  const interactionsTableData: InteractionSpanSampleRowWithScore[] = data.sort(
    (a, b) => a.inpScore - b.inpScore
  );

  return {
    data: interactionsTableData,
    isLoading: isFetching,
  };
}
