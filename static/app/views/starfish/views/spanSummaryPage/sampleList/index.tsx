import omit from 'lodash/omit';

import useRouter from 'sentry/utils/useRouter';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleInfo from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleInfo';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

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
      <SampleInfo groupId={groupId} transactionName={transactionName} />
      <h5>{DataTitles.p95}</h5>
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
