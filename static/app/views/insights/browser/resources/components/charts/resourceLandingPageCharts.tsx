import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {EMPTY_OPTION_VALUE, MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {
  getDurationChartTitle,
  getThroughputChartTitle,
} from 'sentry/views/insights/common/views/spans/types';
import type {ModuleFilters} from 'sentry/views/insights/common/views/spans/useModuleFilters';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_DOMAIN} = SpanMetricsField;

type Props = {
  appliedFilters: ModuleFilters;
  extraQuery?: string[];
};

export function ResourceLandingPageCharts({appliedFilters, extraQuery}: Props) {
  let query: string = buildDiscoverQueryConditions(appliedFilters);

  if (extraQuery) {
    query += ` ${extraQuery.join(' ')}`;
  }

  const {data, isPending, error} = useSpanMetricsSeries(
    {
      search: new MutableSearch(query),
      yAxis: ['spm()', `avg(${SPAN_SELF_TIME})`],
      transformAliasToInputFormat: true,
    },
    'api.starfish.span-time-charts'
  );

  return (
    <ChartsContainer>
      <ChartsContainerItem>
        <InsightsLineChartWidget
          title={getThroughputChartTitle('resource')}
          series={[data['spm()']]}
          isLoading={isPending}
          error={error}
        />
      </ChartsContainerItem>

      <ChartsContainerItem>
        <InsightsLineChartWidget
          title={getDurationChartTitle('resource')}
          series={[data[`avg(${SPAN_SELF_TIME})`]]}
          isLoading={isPending}
          error={error}
        />
      </ChartsContainerItem>
    </ChartsContainer>
  );
}

const SPAN_FILTER_KEYS = ['span_operation', SPAN_DOMAIN, 'action'];

const buildDiscoverQueryConditions = (appliedFilters: ModuleFilters) => {
  const result = Object.keys(appliedFilters)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    .filter(key => Boolean(appliedFilters[key]))
    .map(key => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const value = appliedFilters[key];
      if (key === SPAN_DOMAIN && value === EMPTY_OPTION_VALUE) {
        return [`!has:${SPAN_DOMAIN}`];
      }
      return `${key}:${value}`;
    });

  result.push(`has:${SPAN_DESCRIPTION}`);

  return result.join(' ');
};

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;
