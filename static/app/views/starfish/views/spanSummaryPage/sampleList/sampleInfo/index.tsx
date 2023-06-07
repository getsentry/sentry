import {formatPercentage} from 'sentry/utils/formatters';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useApplicationMetrics} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage';

type Props = {
  groupId: string;
  transactionName: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName} = props;

  const {data: spanMetrics} = useSpanTransactionMetrics({group: groupId}, [
    transactionName,
  ]);
  const {data: applicationMetrics} = useApplicationMetrics();
  const spansPerSecond = spanMetrics[transactionName]?.spans_per_second;
  const p95 = spanMetrics[transactionName]?.p95;
  const span_total_time = spanMetrics[transactionName]?.total_time;
  const application_total_time = applicationMetrics['sum(span.duration)'];

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
          formattedTimeSpent={formatPercentage(span_total_time / application_total_time)}
          totalSpanTime={span_total_time}
        />
      </Block>
    </BlockContainer>
  );
}

export default SampleInfo;
