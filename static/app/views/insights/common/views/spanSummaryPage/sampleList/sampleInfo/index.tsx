import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
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
import type {SpanMetricsQueryFilters, SubregionCode} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

type Props = {
  groupId: string;
  transactionName: string;
  displayedMetrics?: string[];
  subregions?: SubregionCode[];
  transactionMethod?: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName, transactionMethod, subregions} = props;
  const {setPageError} = usePageAlert();

  const ribbonFilters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    ribbonFilters['transaction.method'] = transactionMethod;
  }

  if (subregions) {
    ribbonFilters[SpanMetricsField.USER_GEO_SUBREGION] = `[${subregions.join(',')}]`;
  }

  const {data, error, isPending} = useSpanMetrics(
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
    <StyledReadoutRibbon>
      <MetricReadout
        title={getThroughputTitle(spanMetrics?.[SpanMetricsField.SPAN_OP])}
        value={spanMetrics?.['spm()']}
        unit={RateUnit.PER_MINUTE}
        isLoading={isPending}
      />

      <MetricReadout
        title={DataTitles.avg}
        value={spanMetrics?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
        unit={DurationUnit.MILLISECOND}
        isLoading={isPending}
      />

      <MetricReadout
        title={DataTitles.timeSpent}
        value={spanMetrics?.[`sum(${SpanMetricsField.SPAN_SELF_TIME})`]}
        unit={DurationUnit.MILLISECOND}
        tooltip={getTimeSpentExplanation(
          spanMetrics?.['time_spent_percentage()'],
          spanMetrics?.[SpanMetricsField.SPAN_OP]
        )}
        isLoading={isPending}
      />
    </StyledReadoutRibbon>
  );
}

const StyledReadoutRibbon = styled(ReadoutRibbon)`
  margin-bottom: ${space(2)};
`;

export default SampleInfo;
