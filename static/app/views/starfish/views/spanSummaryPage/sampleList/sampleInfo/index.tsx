import {CSSProperties} from 'react';

import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsFields;

type Props = {
  groupId: string;
  transactionMethod: string;
  transactionName: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName, transactionMethod} = props;
  const {setPageError} = usePageError();

  const {data: spanMetrics, error} = useSpanMetrics(
    {group: groupId},
    {transactionName, 'transaction.method': transactionMethod},
    [
      SPAN_OP,
      'sps()',
      `sum(${SPAN_SELF_TIME})`,
      `p95(${SPAN_SELF_TIME})`,
      'time_spent_percentage(local)',
    ],
    'api.starfish.span-summary-panel-metrics'
  );

  const style: CSSProperties = {
    textAlign: 'left',
  };

  if (error) {
    setPageError(error.message);
  }

  return (
    <BlockContainer>
      <Block title={getThroughputTitle(spanMetrics?.[SPAN_OP])}>
        <ThroughputCell
          containerProps={{style}}
          throughputPerSecond={spanMetrics?.['sps()']}
        />
      </Block>
      <Block title={DataTitles.p95}>
        <DurationCell
          containerProps={{style}}
          milliseconds={spanMetrics?.[`p95(${SPAN_SELF_TIME})`]}
        />
      </Block>
    </BlockContainer>
  );
}

export default SampleInfo;
