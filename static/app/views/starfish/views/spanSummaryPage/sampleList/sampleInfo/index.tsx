import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

type Props = {
  groupId: string;
  transactionName: string;
  transactionMethod?: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName, transactionMethod} = props;
  const {setPageError} = usePageAlert();

  const filters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  const {
    data,
    error,
    isLoading: areSpanMetricsLoading,
  } = useSpanMetrics({
    filters,
    fields: [
      SPAN_OP,
      'spm()',
      `sum(${SPAN_SELF_TIME})`,
      `avg(${SPAN_SELF_TIME})`,
      'time_spent_percentage()',
      'count()',
    ],
    enabled: Object.values(filters).every(value => Boolean(value)),
    referrer: 'api.starfish.span-summary-panel-metrics',
  });

  const spanMetrics = data[0] ?? {};

  if (error) {
    setPageError(error.message);
  }

  return (
    <SampleInfoContainer>
      <MetricsRibbon>
        <MetricReadout
          align="left"
          title={getThroughputTitle(spanMetrics?.[SPAN_OP])}
          value={spanMetrics?.[`${SpanFunction.SPM}()`]}
          unit={RateUnit.PER_MINUTE}
          isLoading={areSpanMetricsLoading}
        />

        <MetricReadout
          align="left"
          title={DataTitles.avg}
          value={spanMetrics?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
          unit={DurationUnit.MILLISECOND}
          isLoading={areSpanMetricsLoading}
        />

        <MetricReadout
          align="left"
          title={DataTitles.timeSpent}
          value={spanMetrics?.['sum(span.self_time)']}
          unit={DurationUnit.MILLISECOND}
          tooltip={getTimeSpentExplanation(
            spanMetrics?.['time_spent_percentage()'],
            spanMetrics?.['span.op']
          )}
          isLoading={areSpanMetricsLoading}
        />
      </MetricsRibbon>
    </SampleInfoContainer>
  );
}

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

const SampleInfoContainer = styled('div')`
  display: flex;
`;

export default SampleInfo;
