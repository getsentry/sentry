import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

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

  const {data, error, isLoading} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(ribbonFilters),
      fields: [
        SpanMetricsField.SPAN_OP,
        'spm()',
        `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
        `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
        'time_spent_percentage()',
      ],
      enabled: Object.values(ribbonFilters).every(value => Boolean(value)),
    },
    'api.starfish.span-summary-panel-metrics'
  );

  const spanMetrics = data[0] ?? {};

  if (error) {
    setPageError(error.message);
  }

  return (
    <ReadoutRibbon>
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
    </ReadoutRibbon>
  );
}

export default SampleInfo;
