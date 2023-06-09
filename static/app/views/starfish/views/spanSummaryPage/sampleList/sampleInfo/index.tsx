import {formatPercentage} from 'sentry/utils/formatters';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage';

type Props = {
  groupId: string;
  transactionName: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName} = props;

  const {data: spanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName},
    ['sps()', 'sum(span.duration)', 'p95(span.duration)', 'time_spent_percentage(local)'],
    'span-summary-panel-metrics'
  );

  return (
    <BlockContainer>
      <Block title={DataTitles.throughput}>
        <ThroughputCell throughputPerSecond={spanMetrics?.['sps()']} />
      </Block>
      <Block title={DataTitles.p95}>
        <DurationCell milliseconds={spanMetrics?.['p95(span.duration)']} />
      </Block>
      <Block title={DataTitles.timeSpent}>
        <TimeSpentCell
          formattedTimeSpent={formatPercentage(
            spanMetrics?.['time_spent_percentage(local)']
          )}
          totalSpanTime={spanMetrics?.['sum(span.duration)']}
        />
      </Block>
    </BlockContainer>
  );
}

export default SampleInfo;
