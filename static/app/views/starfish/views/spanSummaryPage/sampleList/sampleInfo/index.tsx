import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

type Props = {
  groupId: string;
  transactionName: string;
  displayedMetrics?: string[];
  transactionMethod?: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName, transactionMethod} = props;
  const {setPageError} = usePageAlert();

  const ribbonFilters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    ribbonFilters['transaction.method'] = transactionMethod;
  }

  const {data, error, isLoading} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(ribbonFilters),
    fields: [
      SpanMetricsField.SPAN_OP,
      'spm()',
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      'time_spent_percentage()',
    ],
    enabled: Object.values(ribbonFilters).every(value => Boolean(value)),
    referrer: 'api.starfish.span-summary-panel-metrics',
  });

  const spanMetrics = data[0] ?? {};

  if (error) {
    setPageError(error.message);
  }

  return (
    <MetricsRibbon>
      <MetricReadout
        title={getThroughputTitle(spanMetrics?.[SpanMetricsField.SPAN_OP])}
        align="left"
        value={spanMetrics?.['spm()']}
        unit={RateUnit.PER_MINUTE}
        isLoading={isLoading}
      />

      <MetricReadout
        title={DataTitles.avg}
        align="left"
        value={spanMetrics?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
        unit={DurationUnit.MILLISECOND}
        isLoading={isLoading}
      />

      <MetricReadout
        title={DataTitles.timeSpent}
        align="left"
        value={spanMetrics?.[0]?.[`sum(${SpanMetricsField.SPAN_SELF_TIME}))`]}
        unit={DurationUnit.MILLISECOND}
        tooltip={getTimeSpentExplanation(
          spanMetrics?.[0]?.['time_spent_percentage()'],
          spanMetrics?.[SpanMetricsField.SPAN_OP]
        )}
        isLoading={isLoading}
      />
    </MetricsRibbon>
  );
}

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

export default SampleInfo;
