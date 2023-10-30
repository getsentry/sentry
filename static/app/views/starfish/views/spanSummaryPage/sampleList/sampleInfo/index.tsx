import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import {RateUnits} from 'sentry/utils/discover/fields';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

type Props = {
  groupId: string;
  transactionName: string;
  transactionMethod?: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName, transactionMethod} = props;
  const {setPageError} = usePageError();

  const filters = {
    transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  const {data: spanMetrics, error} = useSpanMetrics(
    groupId,
    filters,
    [
      SPAN_OP,
      'spm()',
      `sum(${SPAN_SELF_TIME})`,
      `avg(${SPAN_SELF_TIME})`,
      'time_spent_percentage()',
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
    <SampleInfoContainer>
      <BlockContainer>
        <Block title={getThroughputTitle(spanMetrics?.[SPAN_OP])} alignment="left">
          <ThroughputCell
            containerProps={{style}}
            rate={spanMetrics?.['spm()']}
            unit={RateUnits.PER_MINUTE}
          />
        </Block>

        <Block title={DataTitles.avg} alignment="left">
          <DurationCell
            containerProps={{style}}
            milliseconds={spanMetrics?.[`avg(${SPAN_SELF_TIME})`]}
          />
        </Block>

        <Block title={DataTitles.timeSpent} alignment="left">
          <TimeSpentCell
            containerProps={{style}}
            percentage={spanMetrics?.[`time_spent_percentage()`]}
            total={spanMetrics?.[`sum(${SPAN_SELF_TIME})`]}
            op={spanMetrics?.['span.op']}
          />
        </Block>
      </BlockContainer>
    </SampleInfoContainer>
  );
}

const SampleInfoContainer = styled('div')`
  display: flex;
`;

export default SampleInfo;
