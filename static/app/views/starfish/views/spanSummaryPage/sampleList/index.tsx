import {useCallback, useState} from 'react';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';

import {trackAnalytics} from 'sentry/utils/analytics';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
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
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );
  const detailKey =
    groupId && transactionName && transactionMethod
      ? `${groupId}:${transactionName}:${transactionMethod}`
      : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSetHighlightedSpanId = useCallback(
    debounce(id => {
      setHighlightedSpanId(id);
    }, 10),
    []
  );

  const organization = useOrganization();

  return (
    <PageErrorProvider>
      <DetailPanel
        detailKey={detailKey}
        onClose={() => {
          router.push({
            pathname: router.location.pathname,
            query: omit(router.location.query, 'transaction', 'transactionMethod'),
          });
        }}
        onOpen={useCallback(() => {
          trackAnalytics('starfish.panel.open', {organization});
        }, [organization])}
      >
        <h3>{`${transactionMethod} ${transactionName}`}</h3>
        <PageErrorAlert />
        <SampleInfo
          groupId={groupId}
          transactionName={transactionName}
          transactionMethod={transactionMethod}
        />

        <DurationChart
          groupId={groupId}
          transactionName={transactionName}
          transactionMethod={transactionMethod}
          onClickSample={span => {
            router.push(
              `/performance/${span.project}:${span['transaction.id']}/#span-${span.span_id}`
            );
          }}
          onMouseOverSample={sample => debounceSetHighlightedSpanId(sample.span_id)}
          onMouseLeaveSample={() => debounceSetHighlightedSpanId(undefined)}
          highlightedSpanId={highlightedSpanId}
        />

        <SampleTable
          highlightedSpanId={highlightedSpanId}
          transactionMethod={transactionMethod}
          onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
          onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
          groupId={groupId}
          transactionName={transactionName}
        />
      </DetailPanel>
    </PageErrorProvider>
  );
}
