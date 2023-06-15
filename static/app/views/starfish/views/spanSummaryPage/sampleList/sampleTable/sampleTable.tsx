import {Fragment} from 'react';
import keyBy from 'lodash/keyBy';

import Pagination from 'sentry/components/pagination';
import {SpanSamplesTable} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import {useTransactions} from 'sentry/views/starfish/queries/useTransactions';
import {SpanMetricsFields} from 'sentry/views/starfish/types';

const {SPAN_SELF_TIME} = SpanMetricsFields;

type Props = {
  groupId: string;
  transactionName: string;
  user?: string;
};

function SampleTable({groupId, transactionName}: Props) {
  const {data: spanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName},
    [`p95(${SPAN_SELF_TIME})`],
    'span-summary-panel-samples-table-p95'
  );

  const {
    data: spans,
    isLoading: areSpanSamplesLoading,
    pageLinks,
  } = useSpanSamples(
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
    <Fragment>
      <SpanSamplesTable
        data={spans.map(sample => {
          return {
            ...sample,
            transaction: transactionsById[sample.transaction_id],
          };
        })}
        isLoading={areSpanSamplesLoading || areTransactionsLoading}
        p95={spanMetrics?.[`p95(${SPAN_SELF_TIME})`]}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export default SampleTable;
