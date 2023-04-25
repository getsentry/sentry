import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import moment from 'moment';

import {CompactSelect} from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

import EndpointTable from './endpointTable';
import HostTable from './hostTable';
import {getEndpointDomainsQuery, getEndpointGraphQuery} from './queries';

export const HOST = 'http://localhost:8080';

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
  const [state, setState] = useState<{action: string; domain: string}>({
    action: '',
    domain: '',
  });

  const {isLoading: _isDomainsLoading, data: domains} = useQuery({
    queryKey: ['domains'],
    queryFn: () =>
      fetch(`${HOST}/?query=${getEndpointDomainsQuery()}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isGraphLoading, data: graphData} = useQuery({
    queryKey: ['graph', pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getEndpointGraphQuery({
          datetime: pageFilter.selection.datetime,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const quantiles = ['p50', 'p75', 'p95', 'p99'];

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
      value: datum.count,
      name: datum.interval,
    });
    failureRateSeries.data.push({
      value: datum.failure_rate,
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

      <EndpointTable
        location={location}
        onSelect={onSelect}
        filterOptions={{...state, datetime: pageFilter.selection.datetime}}
      />

      <HostTable location={location} />
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
  const themes = useTheme();
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
      disableMultiAxis
      definedAxisTicks={4}
      stacked
      isLineChart
      chartColors={chartColors ?? themes.charts.getColorPalette(2)}
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
