import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

const HOST = 'http://localhost:8080';

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

export default function APIModuleView({action, table, onChange}: Props) {
  const OPERATION_QUERY = `
  select
    action as key,
    uniq(description) as value
  from default.spans_experimental_starfish
  where
    startsWith(span_operation, 'db') and
    span_operation != 'db.redis' and
    action != ''
  group by action
  order by -power(10, floor(log10(uniq(description)))), -quantile(0.75)(exclusive_time)
  `;
  const actionQuery = action !== 'ALL' ? `and action = '${action}'` : '';
  const TABLE_QUERY = `
  select
    domain as key,
    quantile(0.75)(exclusive_time) as value
  from default.spans_experimental_starfish
  where
    startsWith(span_operation, 'db') and
    span_operation != 'db.redis' and
    action != ''
    ${actionQuery}
  group by domain
  order by -power(10, floor(log10(uniq(description)))), -quantile(0.75)(exclusive_time)
  `;
  const TOP_QUERY = `
  select floor(quantile(0.75)(exclusive_time), 5) as p75, action,
       toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  from default.spans_experimental_starfish
 where action in (
        select action
          from default.spans_experimental_starfish
         where startsWith(span_operation, 'db') and
              span_operation != 'db.redis' and
              action != ''
         group by action
         order by -power(10, floor(log10(uniq(description)))), -quantile(0.75)(exclusive_time)
         limit 5
       )
 group by interval,
          action
 order by interval,
          action
  `;
  const TOP_TABLE_QUERY = `
  select floor(quantile(0.75)(exclusive_time), 5) as p75, domain,
       toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  from default.spans_experimental_starfish
 where domain in (
        select domain
          from default.spans_experimental_starfish
         where startsWith(span_operation, 'db') and
              span_operation != 'db.redis' and
              domain != ''
              ${actionQuery}
         group by domain
         order by -power(10, floor(log10(uniq(description)))), -quantile(0.75)(exclusive_time)
         limit 5
       )
 group by interval,
          domain
 order by interval,
          domain
  `;

  const {data: operationData} = useQuery({
    queryKey: ['operation'],
    queryFn: () => fetch(`${HOST}/?query=${OPERATION_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {data: tableData} = useQuery({
    queryKey: ['table', action],
    queryFn: () => fetch(`${HOST}/?query=${TABLE_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {isLoading: isTopGraphLoading, data: topGraphData} = useQuery({
    queryKey: ['topGraph'],
    queryFn: () => fetch(`${HOST}/?query=${TOP_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {isLoading: tableGraphLoading, data: tableGraphData} = useQuery({
    queryKey: ['topTable', action],
    queryFn: () => fetch(`${HOST}/?query=${TOP_TABLE_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const seriesByDomain: {[action: string]: Series} = {};
  if (!tableGraphLoading) {
    tableGraphData.forEach(datum => {
      seriesByDomain[datum.domain] = {
        seriesName: datum.domain,
        data: [],
      };
    });

    tableGraphData.forEach(datum => {
      seriesByDomain[datum.domain].data.push({
        value: datum.p75,
        name: datum.interval,
      });
    });
  }

  const topDomains = Object.values(seriesByDomain);

  const seriesByQuery: {[action: string]: Series} = {};
  if (!isTopGraphLoading) {
    topGraphData.forEach(datum => {
      seriesByQuery[datum.action] = {
        seriesName: datum.action,
        data: [],
      };
    });

    topGraphData.forEach(datum => {
      seriesByQuery[datum.action].data.push({
        value: datum.p75,
        name: datum.interval,
      });
    });
  }

  const topData = Object.values(seriesByQuery);

  return (
    <Fragment>
      <ChartPanel title={t('Slowest Operations')}>
        <Chart
          statsPeriod="24h"
          height={180}
          data={topData}
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
          disableMultiAxis
          definedAxisTicks={4}
          isLineChart
          showLegend
        />
      </ChartPanel>
      <Selectors>
        Operation:
        <CompactSelect
          value={action}
          options={parseOptions(operationData, 'query')}
          menuTitle="Operation"
          onChange={opt => onChange('action', opt.value)}
        />
      </Selectors>
      {tableData.length === 1 && tableData[0].key === '' ? (
        <Fragment />
      ) : (
        <Fragment>
          <ChartPanel title={t('Slowest Tables')}>
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
              disableMultiAxis
              definedAxisTicks={4}
              isLineChart
              showLegend
            />
          </ChartPanel>
          <Selectors>
            Table:
            <CompactSelect
              value={table}
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
`;
