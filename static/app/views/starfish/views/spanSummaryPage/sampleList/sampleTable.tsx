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
  const p50 = data[0]?.p50 ?? 0;

  const {data: sampleListData, isLoading} = useQueryGetSpanTransactionSamples({
    groupId,
    transactionName,
  });

  return <SpanSamplesTable data={sampleListData} isLoading={isLoading} p50={p50} />;
}

export default SampleTable;
