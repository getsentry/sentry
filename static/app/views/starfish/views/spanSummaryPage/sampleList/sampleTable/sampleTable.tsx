import {Fragment} from 'react';
import keyBy from 'lodash/keyBy';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {SpanSamplesTable} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import {useTransactions} from 'sentry/views/starfish/queries/useTransactions';
import {SpanMetricsFields} from 'sentry/views/starfish/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsFields;

type Props = {
  groupId: string;
  transactionMethod: string;
  transactionName: string;
  user?: string;
};

function SampleTable({groupId, transactionName, transactionMethod}: Props) {
  const {data: spanMetrics, isFetching: isFetchingSpanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName, 'transaction.method': transactionMethod},
    [`p95(${SPAN_SELF_TIME})`, SPAN_OP],
    'span-summary-panel-samples-table-p95'
  );

  const {
    data: spans,
    isFetching: isFetchingSamples,
    refetch,
  } = useSpanSamples({
    groupId,
    transactionName,
    transactionMethod,
  });

  const {data: transactions, isFetching: areTransactionsFetching} = useTransactions(
    spans.map(span => span['transaction.id']),
    'span-summary-panel-samples-table-transactions'
  );

  const transactionsById = keyBy(transactions, 'id');

  const areNoSamples = !isFetchingSamples && spans.length === 0;

  const isLoading =
    isFetchingSpanMetrics ||
    isFetchingSamples ||
    (!areNoSamples && areTransactionsFetching);

  return (
    <Fragment>
      <SpanSamplesTable
        data={spans.map(sample => {
          return {
            ...sample,
            op: spanMetrics['span.op'],
            transaction: transactionsById[sample['transaction.id']],
          };
        })}
        isLoading={isLoading}
        p95={spanMetrics?.[`p95(${SPAN_SELF_TIME})`]}
      />
      <Button onClick={() => refetch()}>{t('Load More Samples')}</Button>
    </Fragment>
  );
}

export default SampleTable;
