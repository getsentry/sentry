import omit from 'lodash/omit';

import useRouter from 'sentry/utils/useRouter';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleInfo from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleInfo';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

type Props = {
  groupId: string;
  transactionMethod: string;
  transactionName: string;
};

export function SampleList({groupId, transactionName, transactionMethod}: Props) {
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
      <h3>{`${transactionMethod} ${transactionName}`}</h3>

      <SampleInfo
        groupId={groupId}
        transactionName={transactionName}
        transactionMethod={transactionMethod}
      />

      <DurationChart
        groupId={groupId}
        transactionName={transactionName}
        transactionMethod={transactionMethod}
      />

      <SampleTable
        groupId={groupId}
        transactionName={transactionName}
        transactionMethod={transactionMethod}
      />
    </DetailPanel>
  );
}
