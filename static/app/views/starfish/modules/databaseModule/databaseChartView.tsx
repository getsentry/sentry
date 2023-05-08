import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {
  useGetTransactionsForTables,
  useQueryDbOperations,
  useQueryDbTables,
  useQueryTopDbOperationsChart,
  useQueryTopTablesChart,
} from 'sentry/views/starfish/modules/databaseModule/queries';
import {queryToSeries} from 'sentry/views/starfish/modules/databaseModule/utils';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

const INTERVAL = 12;

type Props = {
  action: string;
  location: Location;
  onChange: (action: string, value: string) => void;
  table: string;
};

function parseOptions(options, label) {
  const prefix = <span>{t('Operation')}</span>;

  return [
    {
      value: 'ALL',
      prefix,
      label: `ALL`,
    },
    ...options.map(action => {
      return {
        value: action.key,
        prefix,
        label: `${action.key || 'null'} - ${action.value} ${label}`,
      };
    }),
  ];
}

export default function DatabaseChartView({action, table, onChange}: Props) {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(
    pageFilter.selection.datetime
  );

  const {data: operationData} = useQueryDbOperations();
  const {data: tableData} = useQueryDbTables(action);
  const {isLoading: isTopGraphLoading, data: topGraphData} =
    useQueryTopDbOperationsChart(INTERVAL);
  const {isLoading: tableGraphLoading, data: tableGraphData} = useQueryTopTablesChart(
    action,
    INTERVAL
  );

  const seriesByDomain: {[action: string]: Series} = {};
  const tpmByDomain: {[action: string]: Series} = {};
  if (!tableGraphLoading) {
    tableGraphData.forEach(datum => {
      seriesByDomain[datum.domain] = {
        seriesName: datum.domain,
        data: [],
      };
      tpmByDomain[datum.domain] = {
        seriesName: datum.domain,
        data: [],
      };
    });

    tableGraphData.forEach(datum => {
      seriesByDomain[datum.domain].data.push({
        value: datum.p75,
        name: datum.interval,
      });
      tpmByDomain[datum.domain].data.push({
        value: datum.count,
        name: datum.interval,
      });
    });
  }

  const tableNames = [...new Set(tableGraphData.map(d => d.domain))];
  const {isLoading: isTopTransactionDataLoading, data: topTransactionsData} =
    useGetTransactionsForTables(tableNames, INTERVAL);

  const tpmTransactionSeries = queryToSeries(
    topTransactionsData,
    'transaction',
    'count',
    startTime,
    endTime
  );

  const p75TransactionSeries = queryToSeries(
    topTransactionsData,
    'transaction',
    'p75',
    startTime,
    endTime
  );

  const topDomains = Object.values(seriesByDomain).map(series =>
    zeroFillSeries(
      series,
      moment.duration(INTERVAL, 'hours'),
      moment(start_timestamp),
      moment(end_timestamp)
    )
  );
  const tpmDomains = Object.values(tpmByDomain).map(series =>
    zeroFillSeries(
      series,
      moment.duration(INTERVAL, 'hours'),
      moment(start_timestamp),
      moment(end_timestamp)
    )
  );

  const tpmByQuery: {[query: string]: Series} = {};

  const seriesByQuery: {[action: string]: Series} = {};
  if (!isTopGraphLoading) {
    topGraphData.forEach(datum => {
      seriesByQuery[datum.action] = {
        seriesName: datum.action,
        data: [],
      };
      tpmByQuery[datum.action] = {
        seriesName: datum.action,
        data: [],
      };
    });

    topGraphData.forEach(datum => {
      seriesByQuery[datum.action].data.push({
        value: datum.p75,
        name: datum.interval,
      });
      tpmByQuery[datum.action].data.push({
        value: datum.count,
        name: datum.interval,
      });
    });
  }

  return (
    <Fragment>
      <ChartsContainer>
        <ChartsContainerItem>
          <ChartPanel title={t('Top Transactions P75')}>
            <Chart
              statsPeriod="24h"
              height={180}
              data={p75TransactionSeries}
              start=""
              end=""
              loading={isTopTransactionDataLoading}
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
          <ChartPanel title={t('Top Transactions Throughput')}>
            <Chart
              statsPeriod="24h"
              height={180}
              data={tpmTransactionSeries}
              start=""
              end=""
              loading={isTopTransactionDataLoading}
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
      <Selectors>
        <CompactSelect
          value={action}
          triggerProps={{prefix: t('Operation')}}
          options={parseOptions(operationData, 'query')}
          menuTitle="Operation"
          onChange={opt => onChange('action', opt.value)}
        />
      </Selectors>
      {tableData.length === 1 && tableData[0].key === '' ? (
        <Fragment />
      ) : (
        <Fragment>
          <ChartsContainer>
            <ChartsContainerItem>
              <ChartPanel title={t('Slowest Tables P75')}>
                <Chart
                  statsPeriod="24h"
                  height={180}
                  data={topDomains}
                  start=""
                  end=""
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
              <ChartPanel title={t('Table Throughput')}>
                <Chart
                  statsPeriod="24h"
                  height={180}
                  data={tpmDomains}
                  start=""
                  end=""
                  loading={isTopGraphLoading}
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
          <Selectors>
            <CompactSelect
              value={table}
              triggerProps={{prefix: t('Table')}}
              options={parseOptions(tableData, 'p75')}
              menuTitle="Table"
              onChange={opt => onChange('table', opt.value)}
            />
          </Selectors>
        </Fragment>
      )}
    </Fragment>
  );
}

const Selectors = styled(`div`)`
  display: flex;
  margin-bottom: ${space(2)};
`;

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;
