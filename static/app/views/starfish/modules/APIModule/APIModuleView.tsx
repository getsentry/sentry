import {Fragment, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {CompactSelect} from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {INTERNAL_API_REGEX} from 'sentry/views/starfish/modules/APIModule/constants';
import {HostDetails} from 'sentry/views/starfish/modules/APIModule/hostDetails';
import {queryToSeries} from 'sentry/views/starfish/modules/databaseModule/utils';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

import EndpointTable from './endpointTable';
import HostTable from './hostTable';
import {
  getEndpointDomainsEventView,
  getEndpointDomainsQuery,
  getEndpointGraphEventView,
  getEndpointGraphQuery,
  useGetTransactionsForHosts,
} from './queries';

const HTTP_ACTION_OPTIONS = [
  {value: '', label: 'All'},
  ...['GET', 'POST', 'PUT', 'DELETE'].map(action => ({
    value: action,
    label: action,
  })),
];

type Props = {
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
};

export type DataRow = {
  count: number;
  description: string;
  domain: string;
};

export default function APIModuleView({location, onSelect}: Props) {
  const themes = useTheme();
  const pageFilter = usePageFilters();
  const [state, setState] = useState<{
    action: string;
    domain: string;
    transaction: string;
  }>({
    action: '',
    domain: '',
    transaction: '',
  });
  const endpointTableRef = useRef<HTMLInputElement>(null);
  const organization = useOrganization();

  const endpointsDomainEventView = getEndpointDomainsEventView({
    datetime: pageFilter.selection.datetime,
  });
  const endpointsDomainQuery = getEndpointDomainsQuery({
    datetime: pageFilter.selection.datetime,
  });

  const {selection} = pageFilter;
  const {projects, environments, datetime} = selection;

  useApiQuery<null>(
    [
      `/organizations/${organization.slug}/events-starfish/`,
      {
        query: {
          ...{
            environment: environments,
            project: projects.map(proj => String(proj)),
          },
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {
      staleTime: 10,
    }
  );

  const {isLoading: _isDomainsLoading, data: domains} = useSpansQuery({
    eventView: endpointsDomainEventView,
    queryString: endpointsDomainQuery,
    initialData: [],
  });

  const endpointsGraphEventView = getEndpointGraphEventView({
    datetime: pageFilter.selection.datetime,
  });

  const {isLoading: isGraphLoading, data: graphData} = useSpansQuery({
    eventView: endpointsGraphEventView,
    queryString: getEndpointGraphQuery({
      datetime: pageFilter.selection.datetime,
    }),
    initialData: [],
  });

  const quantiles = [
    'p50(span.self_time)',
    'p75(span.self_time)',
    'p95(span.self_time)',
    'p99(span.self_time)',
  ];

  const seriesByQuantile: {[quantile: string]: Series} = {};
  quantiles.forEach(quantile => {
    seriesByQuantile[quantile] = {
      seriesName: quantile,
      data: [],
    };
  });
  const countSeries: Series = {
    seriesName: 'count',
    data: [],
  };
  const failureRateSeries: Series = {
    seriesName: 'failure_rate',
    data: [],
  };

  graphData.forEach(datum => {
    quantiles.forEach(quantile => {
      seriesByQuantile[quantile].data.push({
        value: datum[quantile],
        name: datum.interval,
      });
    });
    countSeries.data.push({
      value: datum['count()'],
      name: datum.interval,
    });
    failureRateSeries.data.push({
      value: datum['failure_rate()'],
      name: datum.interval,
    });
  });

  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);
  const [zeroFilledQuantiles, zeroFilledCounts, zeroFilledFailureRate] = [
    seriesByQuantile,
    [countSeries],
    [failureRateSeries],
  ].map(seriesGroup =>
    Object.values(seriesGroup).map(series =>
      zeroFillSeries(series, moment.duration(12, 'hours'), startTime, endTime)
    )
  );

  const setAction = (action: string) => {
    setState({
      ...state,
      action,
    });
  };

  const setDomain = (domain: string) => {
    setState({
      ...state,
      domain,
    });
  };
  const domainOptions = [
    {value: '', label: 'All'},
    ...domains
      .filter(({domain}) => domain !== '')
      .map(({domain}) => ({
        value: domain,
        label: domain,
      })),
  ];

  const interval = getInterval(pageFilter.selection.datetime, 'low');
  const {isLoading: isTopTransactionDataLoading, data: topTransactionsData} =
    useGetTransactionsForHosts(
      domains
        .map(({domain}) => domain)
        .filter(domain => !domain.match(INTERNAL_API_REGEX)),
      interval
    );

  const tpmTransactionSeries = queryToSeries(topTransactionsData, 'group', 'epm()');

  const p75TransactionSeries = queryToSeries(
    topTransactionsData,
    'group',
    'p75(transaction.duration)'
  );

  return (
    <Fragment>
      <FilterOptionsContainer>
        <CompactSelect
          triggerProps={{prefix: t('Service')}}
          value="project"
          options={[{value: 'project', label: 'Project'}]}
          onChange={() => void 0}
        />
        <DatePageFilter alignDropdown="left" />
      </FilterOptionsContainer>
      <ChartsContainer>
        <ChartsContainerItem>
          <ChartPanel title={t('Top Transactions Throughput')}>
            <APIModuleChart
              data={tpmTransactionSeries}
              loading={isTopTransactionDataLoading}
            />
          </ChartPanel>
        </ChartsContainerItem>
        <ChartsContainerItem>
          <ChartPanel title={t('Top Transactions p75')}>
            <APIModuleChart
              data={p75TransactionSeries}
              loading={isTopTransactionDataLoading}
            />
          </ChartPanel>
        </ChartsContainerItem>
      </ChartsContainer>
      <ChartsContainer>
        <ChartsContainerItem>
          <ChartPanel title={t('Throughput')}>
            <APIModuleChart data={zeroFilledCounts} loading={isGraphLoading} />
          </ChartPanel>
        </ChartsContainerItem>
        <ChartsContainerItem>
          <ChartPanel title={t('Response Time')}>
            <APIModuleChart data={zeroFilledQuantiles} loading={isGraphLoading} />
          </ChartPanel>
        </ChartsContainerItem>
        <ChartsContainerItem>
          <ChartPanel title={t('Error Rate')}>
            <APIModuleChart
              data={zeroFilledFailureRate}
              loading={isGraphLoading}
              chartColors={[themes.charts.getColorPalette(2)[2]]}
            />
          </ChartPanel>
        </ChartsContainerItem>
      </ChartsContainer>
      <HostTable
        location={location}
        setDomainFilter={domain => {
          setDomain(domain);
          // TODO: Cheap way to scroll to the endpoints table without waiting for async request
          setTimeout(() => {
            endpointTableRef.current?.scrollIntoView({
              behavior: 'smooth',
              inline: 'start',
            });
          }, 200);
        }}
      />
      <FilterOptionsContainer>
        <CompactSelect
          triggerProps={{prefix: t('Operation')}}
          value={state.action}
          options={HTTP_ACTION_OPTIONS}
          onChange={({value}) => setAction(value)}
        />
        <CompactSelect
          triggerProps={{prefix: t('Domain')}}
          value={state.domain}
          options={domainOptions}
          onChange={({value}) => setDomain(value)}
        />
      </FilterOptionsContainer>

      <div ref={endpointTableRef}>
        {state.domain && <HostDetails host={state.domain} />}
        <EndpointTable
          location={location}
          onSelect={onSelect}
          filterOptions={{...state, datetime: pageFilter.selection.datetime}}
        />
      </div>
    </Fragment>
  );
}

function APIModuleChart({
  data,
  loading,
  chartColors,
}: {
  data: Series[];
  loading: boolean;
  chartColors?: string[];
}) {
  return (
    <Chart
      statsPeriod="24h"
      height={140}
      data={data}
      start=""
      end=""
      loading={loading}
      utc={false}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '0',
      }}
      definedAxisTicks={4}
      stacked
      isLineChart
      chartColors={chartColors}
      disableXAxis
    />
  );
}

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;
