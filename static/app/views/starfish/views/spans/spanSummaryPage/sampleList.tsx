import Detail from 'sentry/views/starfish/components/detailPanel';
import {
  FlexRowContainer,
  FlexRowItem,
} from 'sentry/views/starfish/modules/databaseModule/panel';

type Props = {
  groupId: string;
  onClose: () => void;
  transactionName: string;
};

function SampleList({onClose, groupId, transactionName}: Props) {
  return (
    <Detail detailKey={groupId} onClose={onClose}>
      <FlexRowContainer>
        <FlexRowItem>
          <h3>{transactionName}</h3>
        </FlexRowItem>
      </FlexRowContainer>
    </Detail>
  );
}

export default SampleList;
