import omit from 'lodash/omit';

import {t} from 'sentry/locale';
import useRouter from 'sentry/utils/useRouter';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import DurationChart from 'sentry/views/starfish/views/spans/spanSummaryPage/durationChart';
import SampleTable from 'sentry/views/starfish/views/spans/spanSummaryPage/sampleList/sampleTable';

type Props = {
  groupId: string;
  transactionName: string;
  spanDescription?: string;
};

function SampleList({groupId, transactionName, spanDescription}: Props) {
  const router = useRouter();

  return (
    <DetailPanel
      detailKey={groupId}
      onClose={() => {
        router.push({
          pathname: router.location.pathname,
          query: omit(router.location.query, 'transaction'),
        });
      }}
    >
      <h3>{transactionName}</h3>
      <h5>{t('Duration (p50)')}</h5>

      <DurationChart
        groupId={groupId}
        transactionName={transactionName}
        spanDescription={spanDescription}
      />
      <SampleTable groupId={groupId} transactionName={transactionName} />
    </DetailPanel>
  );
}

export default SampleList;
