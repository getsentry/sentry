import {Fragment, ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

const INTERVAL = 12;

import {ModuleName} from 'sentry/views/starfish/types';

type Props = {
  moduleName: ModuleName;
};

export function Top5DomainsCharts({moduleName = ModuleName.NONE}: Props) {
  const pageFilter = usePageFilters();
  const theme = useTheme();

  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(
    pageFilter.selection.datetime
  );

  const {isLoading: tableGraphLoading, data: tableGraphData} =
    useQueryTopTablesChart(INTERVAL);

  const seriesByDomain: {[action: string]: Series} = {};
  const spmByDomain: {[action: string]: Series} = {};

  if (!tableGraphLoading) {
    tableGraphData.forEach(datum => {
      seriesByDomain[datum.domain] = {
        seriesName: datum.domain,
        data: [],
      };
      spmByDomain[datum.domain] = {
        seriesName: datum.domain,
        data: [],
      };
    });

    tableGraphData.forEach(datum => {
      seriesByDomain[datum.domain].data.push({
        value: datum.p50,
        name: datum.interval,
      });

      spmByDomain[datum.domain].data.push({
        value: datum.spm,
        name: datum.interval,
      });
    });
  }

  const domainP50Series = Object.values(seriesByDomain).map(series =>
    zeroFillSeries(
      series,
      moment.duration(INTERVAL, 'hours'),
      moment(start_timestamp),
      moment(end_timestamp)
    )
  );

  const domainSPMSeries = Object.values(spmByDomain).map(series =>
    zeroFillSeries(
      series,
      moment.duration(INTERVAL, 'hours'),
      moment(start_timestamp),
      moment(end_timestamp)
    )
  );

  const chartColors = [...theme.charts.getColorPalette(6).slice(2, 7), theme.gray300];
  useSynchronizeCharts([!tableGraphLoading]);

  return (
    <Fragment>
      <ChartsContainer>
        <ChartsContainerItem>
          <ChartPanel title={P50_LABEL_FOR_MODULE_NAME[moduleName]}>
            <Chart
              statsPeriod="24h"
              height={180}
              data={domainP50Series}
              start=""
              end=""
              chartColors={chartColors}
              loading={tableGraphLoading}
              utc={false}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '8px',
              }}
              definedAxisTicks={4}
              isLineChart
              showLegend
            />
          </ChartPanel>
        </ChartsContainerItem>

        <ChartsContainerItem>
          <ChartPanel title={SPM_LABEL_FOR_MODULE_NAME[moduleName]}>
            <Chart
              statsPeriod="24h"
              height={180}
              data={domainSPMSeries}
              start=""
              end=""
              chartColors={chartColors}
              loading={tableGraphLoading}
              utc={false}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '8px',
              }}
              definedAxisTicks={4}
              showLegend
              isLineChart
            />
          </ChartPanel>
        </ChartsContainerItem>
      </ChartsContainer>
    </Fragment>
  );
}

const P50_LABEL_FOR_MODULE_NAME: {[key in ModuleName]: ReactNode} = {
  http: t('Top 5 Slowest Hosts Duration (P50)'),
  db: t('Top 5 Slowest Tables Duration (P50)'),
  none: t('Top 5 Slowest Domains Duration (P50)'),
  '': t('Top 5 Slowest Domains Duration (P50)'),
};

const SPM_LABEL_FOR_MODULE_NAME: {[key in ModuleName]: ReactNode} = {
  http: t('Top 5 Slowest Hosts SPM'),
  db: t('Top 5 Slowest Tables SPM'),
  none: t('Top 5 Slowest Domains SPM'),
  '': t('Top 5 Slowest Domains SPM'),
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

import {HOST} from 'sentry/views/starfish/utils/constants';

const useQueryTopTablesChart = (interval: number) => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const topDomainsQuery = `
  SELECT
    domain,
    floor(quantile(0.50)(exclusive_time), 5) AS p50,
    divide(count(), multiply(${interval}, 60)) AS spm,
    toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) AS interval
  FROM spans_experimental_starfish
  WHERE
    1 = 1
    ${dateFilters}
    AND domain IN (
      SELECT domain
      FROM spans_experimental_starfish
      WHERE
        domain != ''
        ${dateFilters}
      GROUP BY domain
      ORDER BY -sum(exclusive_time), -count()
      LIMIT 5
    )
  GROUP BY interval, domain
  ORDER BY interval, domain
  `;

  const topDomainsResponse = useQuery({
    queryKey: ['topTable', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${topDomainsQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const topDomains = [...new Set(topDomainsResponse.data.map(d => d.domain))];

  const otherDomainsQuery = `
  SELECT
    'Other' as domain,
    floor(quantile(0.50)(exclusive_time), 5) as p50,
    divide(count(), multiply(${interval}, 60)) as spm,
    toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
  FROM default.spans_experimental_starfish
  WHERE
    domain NOT IN ('${topDomains.join(`', '`)}')
    ${dateFilters}
  GROUP BY interval
  ORDER BY interval
  `;

  const otherDomainsResponse = useQuery({
    enabled: !topDomainsResponse.isLoading && !!topDomainsResponse.data?.length,
    queryKey: ['topTableOther', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${otherDomainsQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const joinedData = [...topDomainsResponse.data, ...otherDomainsResponse.data];

  return {...otherDomainsResponse, data: joinedData};
};
