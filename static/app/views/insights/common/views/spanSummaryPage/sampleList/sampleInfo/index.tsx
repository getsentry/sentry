import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import type {SpanQueryFilters, SubregionCode} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

type Props = {
  groupId: string;
  transactionName: string;
  displayedMetrics?: string[];
  subregions?: SubregionCode[];
  transactionMethod?: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName, transactionMethod, subregions} = props;
  const {setPageDanger} = usePageAlert();

  const ribbonFilters: SpanQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    ribbonFilters['transaction.method'] = transactionMethod;
  }

  if (subregions) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ribbonFilters[SpanFields.USER_GEO_SUBREGION] = `[${subregions.join(',')}]`;
  }

  const {data, error, isPending} = useSpans(
    {
      search: MutableSearch.fromQueryObject(ribbonFilters),
      fields: [
        SpanFields.SPAN_OP,
        'epm()',
        `sum(${SpanFields.SPAN_SELF_TIME})`,
        `avg(${SpanFields.SPAN_SELF_TIME})`,
      ],
      enabled: Object.values(ribbonFilters).every(value => Boolean(value)),
    },
    'api.insights.span-summary-panel-metrics'
  );

  if (error) {
    setPageDanger(error.message);
  }

  return (
    <StyledReadoutRibbon>
      <MetricReadout
        title={getThroughputTitle(data[0]?.[SpanFields.SPAN_OP])}
        value={data[0]?.['epm()']}
        unit={RateUnit.PER_MINUTE}
        isLoading={isPending}
      />

      <MetricReadout
        title={DataTitles.avg}
        value={data[0]?.[`avg(${SpanFields.SPAN_SELF_TIME})`]}
        unit={DurationUnit.MILLISECOND}
        isLoading={isPending}
      />

      <MetricReadout
        title={DataTitles.timeSpent}
        value={data[0]?.[`sum(${SpanFields.SPAN_SELF_TIME})`]}
        unit={DurationUnit.MILLISECOND}
        isLoading={isPending}
      />
    </StyledReadoutRibbon>
  );
}

const StyledReadoutRibbon = styled(ReadoutRibbon)`
  margin-bottom: ${space(2)};
`;

export default SampleInfo;
