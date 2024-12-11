import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {EMPTY_OPTION_VALUE, MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSynchronizeCharts} from 'sentry/views/insights/common/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {ModuleFilters} from 'sentry/views/insights/common/views/spans/useModuleFilters';
import {SpanMetricsField} from 'sentry/views/insights/types';

import {DurationChart} from './durationChart';
import {ThroughputChart} from './throughputChart';

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
    },
    'api.starfish.span-time-charts'
  );

  useSynchronizeCharts(1, !isPending);

  return (
    <ChartsContainer>
      <ChartsContainerItem>
        <ThroughputChart series={data['spm()']} isLoading={isPending} error={error} />
      </ChartsContainerItem>

      <ChartsContainerItem>
        <DurationChart
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
    .filter(key => Boolean(appliedFilters[key]))
    .map(key => {
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
