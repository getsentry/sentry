import Detail from 'sentry/views/starfish/components/detailPanel';

type Props = {
  groupId: string;
  onClose: () => void;
  transactionName: string;
};

function SampleList({onClose, groupId, transactionName}: Props) {
  return (
    <Detail detailKey={groupId} onClose={onClose}>
      <h3>{transactionName}</h3>
    </Detail>
  );
}

export default SampleList;
