import {formatPercentage} from 'sentry/utils/formatters';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {useSpanTransactions} from 'sentry/views/starfish/queries/useSpanTransactions';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage';

type Props = {
  groupId: string;
  transactionName: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName} = props;

  const {data: spanTransactions} = useSpanTransactions({group_id: groupId});
  const {data: spanMetrics} = useSpanTransactionMetrics(
    {group: groupId},
    spanTransactions.map(row => row.transaction)
  );

  const totalTimeSpent = spanTransactions.reduce(
    (acc, row) => acc + spanMetrics[row.transaction]?.['sum(span.self_time)'],
    0
  );
  const spansPerSecond = spanMetrics[transactionName]?.spans_per_second;
  const p95 = spanMetrics[transactionName]?.p95;
  const span_total_time = spanMetrics[transactionName]?.total_time;

  return (
    <BlockContainer>
      <Block title={DataTitles.throughput}>
        <ThroughputCell throughputPerSecond={spansPerSecond} />
      </Block>
      <Block title={DataTitles.p95}>
        <DurationCell milliseconds={p95} />
      </Block>
      <Block title={DataTitles.timeSpent}>
        <TimeSpentCell
          formattedTimeSpent={formatPercentage(span_total_time / totalTimeSpent)}
          totalSpanTime={span_total_time}
        />
      </Block>
    </BlockContainer>
  );
}

export default SampleInfo;
