import {Fragment, useCallback, useState} from 'react';
import debounce from 'lodash/debounce';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import useRouter from 'sentry/utils/useRouter';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

type Props = {
  groupId: string;
  transactionName: string;
  release?: string;
  transactionMethod?: string;
};

export function ScreenLoadSampleList({
  groupId,
  transactionName,
  transactionMethod,
  release,
}: Props) {
  const router = useRouter();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSetHighlightedSpanId = useCallback(
    debounce(id => {
      setHighlightedSpanId(id);
    }, 10),
    []
  );

  return (
    <Fragment>
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
        release={release}
      />
      <SampleTable
        highlightedSpanId={highlightedSpanId}
        transactionMethod={transactionMethod}
        onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
        onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
        groupId={groupId}
        transactionName={transactionName}
        release={release}
        columnOrder={[
          {
            key: 'transaction_id',
            name: 'Event ID',
            width: COL_WIDTH_UNDEFINED,
          },
          {
            key: 'profile_id',
            name: 'Profile ID',
            width: COL_WIDTH_UNDEFINED,
          },
          {
            key: 'duration',
            name: 'Span Duration',
            width: COL_WIDTH_UNDEFINED,
          },
        ]}
      />
    </Fragment>
  );
}
