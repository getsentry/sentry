import keyBy from 'lodash/keyBy';

import {SpanSamplesTable} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import {useTransactions} from 'sentry/views/starfish/queries/useTransactions';

type Props = {
  groupId: string;
  transactionName: string;
  user?: string;
};

function SampleTable({groupId, transactionName}: Props) {
  const {data: spanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName},
    ['p95(span.duration)'],
    'span-summary-panel-samples-table-p95'
  );

  const {data: spans, isLoading: areSpanSamplesLoading} = useSpanSamples(
    groupId,
    transactionName,
    undefined,
    '-duration',
    'span-summary-panel-samples-table-spans'
  );

  const {data: transactions, isLoading: areTransactionsLoading} = useTransactions(
    spans.map(span => span.transaction_id),
    'span-summary-panel-samples-table-transactions'
  );

  const transactionsById = keyBy(transactions, 'id');

  return (
    <SpanSamplesTable
      data={spans.map(sample => {
        return {
          ...sample,
          transaction: transactionsById[sample.transaction_id],
        };
      })}
      isLoading={areSpanSamplesLoading || areTransactionsLoading}
      p95={spanMetrics?.['p95(span.duration)']}
    />
  );
}

export default SampleTable;
