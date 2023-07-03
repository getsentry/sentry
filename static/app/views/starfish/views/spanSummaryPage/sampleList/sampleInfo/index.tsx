import {CSSProperties} from 'react';

import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage';

const {SPAN_SELF_TIME} = SpanMetricsFields;

type Props = {
  groupId: string;
  transactionMethod: string;
  transactionName: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName, transactionMethod} = props;

  const {data: spanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName, 'transaction.method': transactionMethod},
    [
      'sps()',
      `sum(${SPAN_SELF_TIME})`,
      `p95(${SPAN_SELF_TIME})`,
      'time_spent_percentage(local)',
    ],
    'span-summary-panel-metrics'
  );

  const style: CSSProperties = {
    textAlign: 'left',
  };

  return (
    <BlockContainer>
      <Block title={DataTitles.throughput}>
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
