import {SpanSamplesTable} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {useQuerySpansInTransaction} from 'sentry/views/starfish/views/spanSummaryPage/queries';
import {useQueryGetSpanTransactionSamples} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/queries';

type Props = {
  groupId: string;
  transactionName: string;
  user?: string;
};

function SampleTable({groupId, transactionName}: Props) {
  const {data} = useQuerySpansInTransaction({
    groupId,
  });
  const p95 = data[0]?.p95 ?? 0;

  const {data: sampleListData, isLoading} = useQueryGetSpanTransactionSamples({
    groupId,
    transactionName,
  });

  return <SpanSamplesTable data={sampleListData} isLoading={isLoading} p95={p95} />;
}

export default SampleTable;
