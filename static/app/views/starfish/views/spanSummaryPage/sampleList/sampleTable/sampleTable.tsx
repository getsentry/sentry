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
  transactionName: string;
  user?: string;
};

function SampleTable({groupId, transactionName}: Props) {
  const {data: spanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName},
    [`p95(${SPAN_SELF_TIME})`, SPAN_OP],
    'span-summary-panel-samples-table-p95'
  );

  const {
    data: spans,
    isLoading: areSpanSamplesLoading,
    isRefetching: areSpanSamplesRefetching,
    refetch,
  } = useSpanSamples({
    groupId,
    transactionName,
  });

  const {
    data: transactions,
    isLoading: areTransactionsLoading,
    isRefetching: areTransactionsRefetching,
  } = useTransactions(
    spans.map(span => span['transaction.id']),
    'span-summary-panel-samples-table-transactions'
  );

  const transactionsById = keyBy(transactions, 'id');

  const isLoading =
    areSpanSamplesLoading ||
    areSpanSamplesRefetching ||
    areTransactionsLoading ||
    areTransactionsRefetching;

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
