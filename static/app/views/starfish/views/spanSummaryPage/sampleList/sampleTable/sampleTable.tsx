import {Fragment, useEffect, useState} from 'react';
import keyBy from 'lodash/keyBy';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import useOrganization from 'sentry/utils/useOrganization';
import {SpanSamplesTable} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanSample, useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import {useTransactions} from 'sentry/views/starfish/queries/useTransactions';
import {SpanMetricsFields} from 'sentry/views/starfish/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsFields;

type Props = {
  groupId: string;
  transactionMethod: string;
  transactionName: string;
  highlightedSpanId?: string;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
};

function SampleTable({
  groupId,
  transactionName,
  highlightedSpanId,
  onMouseLeaveSample,
  onMouseOverSample,
  transactionMethod,
}: Props) {
  console.log(groupId, transactionMethod);
  const {data: spanMetrics, isFetching: isFetchingSpanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName, 'transaction.method': transactionMethod},
    [`p95(${SPAN_SELF_TIME})`, SPAN_OP],
    'api.starfish.span-summary-panel-samples-table-p95'
  );
  const organization = useOrganization();

  const {setPageError} = usePageError();

  const {
    data: spans,
    isFetching: isFetchingSamples,
    isEnabled: isSamplesEnabled,
    error: sampleError,
    refetch,
  } = useSpanSamples({
    groupId,
    transactionName,
    transactionMethod,
  });

  const {
    data: transactions,
    isFetching: isFetchingTransactions,
    isEnabled: isTransactionsEnabled,
    error: transactionError,
  } = useTransactions(
    spans.map(span => span['transaction.id']),
    'api.starfish.span-summary-panel-samples-table-transactions'
  );

  const [loadedSpans, setLoadedSpans] = useState(false);
  useEffect(() => {
    if (isFetchingTransactions || isFetchingSamples) {
      setLoadedSpans(false);
      return;
    }
    if (loadedSpans) {
      return;
    }
    trackAnalytics('starfish.samples.loaded', {
      organization,
      count: transactions?.length ?? 0,
    });
    setLoadedSpans(true);
  }, [
    loadedSpans,
    isFetchingSamples,
    transactions,
    isFetchingTransactions,
    organization,
  ]);

  const transactionsById = keyBy(transactions, 'id');

  const areNoSamples = !isFetchingSamples && spans.length === 0;

  const isLoading =
    isFetchingSpanMetrics ||
    isFetchingSamples ||
    !isSamplesEnabled ||
    !isTransactionsEnabled ||
    (!areNoSamples && isFetchingTransactions);

  if (sampleError || transactionError) {
    setPageError(t('An error has occured while loading the samples table'));
  }

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="SpanSummary.Samples.SampleTable"
        hasData={spans.length > 0}
      >
        <SpanSamplesTable
          onMouseLeaveSample={onMouseLeaveSample}
          onMouseOverSample={onMouseOverSample}
          highlightedSpanId={highlightedSpanId}
          data={spans.map(sample => {
            return {
              ...sample,
              op: spanMetrics[SPAN_OP],
              transaction: transactionsById[sample['transaction.id']],
            };
          })}
          isLoading={isLoading}
          p95={spanMetrics?.[`p95(${SPAN_SELF_TIME})`]}
        />
      </VisuallyCompleteWithData>
      <Button onClick={() => refetch()}>{t('Load More Samples')}</Button>
    </Fragment>
  );
}

export default SampleTable;
