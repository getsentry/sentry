import Detail from 'sentry/views/starfish/components/detailPanel';
import SampleTable from 'sentry/views/starfish/views/spans/spanSummaryPage/sampleList/sampleTable';

type Props = {
  groupId: string;
  onClose: () => void;
  transactionName: string;
};

function SampleList({onClose, groupId, transactionName}: Props) {
  return (
    <Detail detailKey={groupId} onClose={onClose}>
      <h3>{transactionName}</h3>
      <SampleTable groupId={groupId} transactionName={transactionName} />
    </Detail>
  );
}

export default SampleList;
