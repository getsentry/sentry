import {t} from 'sentry/locale';
import Detail from 'sentry/views/starfish/components/detailPanel';
import DurationChart from 'sentry/views/starfish/views/spans/spanSummaryPage/durationChart';

type Props = {
  groupId: string;
  onClose: () => void;
  transactionName: string;
  spanDescription?: string;
};

function SampleList({onClose, groupId, transactionName, spanDescription}: Props) {
  return (
    <Detail detailKey={groupId} onClose={onClose}>
      <h3>{transactionName}</h3>
      <h5>{t('Duration (p50)')}</h5>
      <DurationChart
        groupId={groupId}
        transactionName={transactionName}
        spanDescription={spanDescription}
      />
    </Detail>
  );
}

export default SampleList;
