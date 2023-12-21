import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import useOrganization from 'sentry/utils/useOrganization';
import {
  SamplesTableColumnHeader,
  SpanSamplesTable,
} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanSample, useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import {useTransactions} from 'sentry/views/starfish/queries/useTransactions';
import {SpanMetricsField, SpanMetricsQueryFilters} from 'sentry/views/starfish/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

const SpanSamplesTableContainer = styled('div')`
  padding-bottom: ${space(2)};
`;

type Props = {
  groupId: string;
  transactionName: string;
  additionalFields?: string[];
  columnOrder?: SamplesTableColumnHeader[];
  highlightedSpanId?: string;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
  query?: string[];
  release?: string;
  transactionMethod?: string;
};

function SampleTable({
  groupId,
  transactionName,
  highlightedSpanId,
  onMouseLeaveSample,
  onMouseOverSample,
  transactionMethod,
  columnOrder,
  release,
  query,
  additionalFields,
}: Props) {
  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  if (release) {
    filters.release = release;
  }

  const {data, isFetching: isFetchingSpanMetrics} = useSpanMetrics(
    filters,
    [`avg(${SPAN_SELF_TIME})`, SPAN_OP],
    undefined,
    undefined,
    undefined,
    'api.starfish.span-summary-panel-samples-table-avg'
  );

  const spanMetrics = data[0] ?? {};

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
    release,
    query,
    additionalFields,
  });

  const {
    data: transactions,
    isFetching: isFetchingTransactions,
    isEnabled: isTransactionsEnabled,
    isLoading: isLoadingTransactions,
    error: transactionError,
  } = useTransactions(
    spans.map(span => span['transaction.id']),
    'api.starfish.span-summary-panel-samples-table-transactions'
  );

  const [loadedSpans, setLoadedSpans] = useState(false);
  useEffect(() => {
    if (isLoadingTransactions || isFetchingTransactions || !isTransactionsEnabled) {
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
    transactions,
    isFetchingTransactions,
    organization,
    isLoadingTransactions,
    isTransactionsEnabled,
  ]);

  const transactionsById = keyBy(transactions, 'id');

  const areNoSamples = !isFetchingSamples && spans.length === 0;

  const isLoading =
    isFetchingSpanMetrics ||
    isFetchingSamples ||
    !isSamplesEnabled ||
    (!areNoSamples && isFetchingTransactions && !isTransactionsEnabled);

  if (sampleError || transactionError) {
    setPageError(t('An error has occured while loading the samples table'));
  }

  return (
    <SpanSamplesTableContainer>
      <VisuallyCompleteWithData
        id="SpanSummary.Samples.SampleTable"
        hasData={spans.length > 0}
      >
        <SpanSamplesTable
          onMouseLeaveSample={onMouseLeaveSample}
          onMouseOverSample={onMouseOverSample}
          highlightedSpanId={highlightedSpanId}
          columnOrder={columnOrder}
          data={spans.map(sample => {
            return {
              ...sample,
              op: spanMetrics[SPAN_OP],
              transaction: transactionsById[sample['transaction.id']],
            };
          })}
          isLoading={isLoading}
          avg={spanMetrics?.[`avg(${SPAN_SELF_TIME})`]}
        />
      </VisuallyCompleteWithData>
      <Button onClick={() => refetch()}>{t('Try Different Samples')}</Button>
    </SpanSamplesTableContainer>
  );
}

export default SampleTable;
