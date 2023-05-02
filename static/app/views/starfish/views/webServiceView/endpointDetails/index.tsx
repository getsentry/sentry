import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isNil from 'lodash/isNil';
import * as qs from 'query-string';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import FacetBreakdownBar from 'sentry/views/starfish/components/breakdownBar';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import EndpointTable from 'sentry/views/starfish/modules/APIModule/endpointTable';
import DatabaseTableView from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {getMainTable} from 'sentry/views/starfish/modules/databaseModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getModuleBreakdown} from 'sentry/views/starfish/views/webServiceView/queries';

const EventsRequest = withApi(_EventsRequest);

type EndpointAggregateDetails = {
  failureCount: number;
  p50: number;
  tpm: number;
};

export type EndpointDataRow = {
  aggregateDetails: EndpointAggregateDetails;
  endpoint: string;
  httpOp: string;
  transaction: string;
};

type EndpointDetailBodyProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  row: EndpointDataRow;
};

type EndpointDetailProps = Partial<EndpointDetailBodyProps> & {
  onClose: () => void;
};

const HTTP_SPAN_COLUMN_ORDER = [
  {
    key: 'description',
    name: 'URL',
    width: 400,
  },
  {
    key: 'p50(exclusive_time)',
    name: 'p50',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'transaction_count',
    name: 'Transactions',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'total_exclusive_time',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

const DATABASE_SPAN_COLUMN_ORDER = [
  {
    key: 'description',
    name: 'Query',
    width: 400,
  },
  {
    key: 'domain',
    name: 'Table',
    width: 100,
  },
  {
    key: 'epm',
    name: 'Tpm',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p75',
    name: 'p75',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'total_time',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

export default function EndpointDetail({
  row,
  onClose,
  eventView,
  organization,
  location,
}: EndpointDetailProps) {
  if (isNil(row)) {
    return null;
  }
  return (
    <Detail detailKey={row?.endpoint} onClose={onClose}>
      {row && eventView && organization && location && (
        <EndpointDetailBody
          row={row}
          eventView={eventView}
          organization={organization}
          location={location}
        />
      )}
    </Detail>
  );
}

function EndpointDetailBody({
  row,
  eventView,
  organization,
  location,
}: EndpointDetailBodyProps) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const {aggregateDetails} = row;

  const {data: moduleBreakdown} = useQuery({
    queryKey: [`moduleBreakdown${row.transaction}`],
    queryFn: () =>
      fetch(`${HOST}/?query=${getModuleBreakdown({transaction: row.transaction})}`).then(
        res => res.json()
      ),
    retry: false,
    initialData: [],
  });

  const query = new MutableSearch([
    'has:http.method',
    'transaction.op:http.server',
    `transaction:${row.transaction}`,
    `http.method:${row.httpOp}`,
  ]);
  const {startTime, endTime} = getDateFilters(pageFilter);
  const DATE_FILTERS = `
  greater(start_timestamp, fromUnixTimestamp(${startTime.unix()})) and
  less(start_timestamp, fromUnixTimestamp(${endTime.unix()}))
`;
  const transactionFilter =
    row.transaction.length > 0 ? `transaction='${row.transaction}'` : null;

  const {
    isLoading: isTableDataLoading,
    data: tableData,
    isRefetching: isTableRefetching,
  } = useQuery({
    queryKey: ['endpoints', pageFilter.selection.datetime, row.transaction],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getMainTable(
          startTime,
          DATE_FILTERS,
          endTime,
          transactionFilter
        )}&format=sql`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  return (
    <div>
      <h2>{t('Endpoint Detail')}</h2>
      <p>{t('Details of endpoint. More breakdowns, etc. Maybe some trends?')}</p>
      <SubHeader>{t('Endpoint URL')}</SubHeader>
      <pre>{row?.endpoint}</pre>
      <EventsRequest
        query={query.formatString()}
        includePrevious={false}
        partial
        limit={5}
        interval="1h"
        includeTransformedData
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="starfish-homepage-count"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis={['tpm()', 'p50(transaction.duration)']}
        queryExtras={{dataset: 'metrics'}}
      >
        {({results, loading}) => {
          return (
            <Fragment>
              <FlexRowContainer>
                <FlexRowItem>
                  <SubHeader>{t('Throughput')}</SubHeader>
                  <SubSubHeader>
                    {formatAbbreviatedNumber(aggregateDetails.tpm)}
                  </SubSubHeader>
                  <Chart
                    statsPeriod="24h"
                    height={110}
                    data={results?.[0] ? [results?.[0]] : []}
                    start=""
                    end=""
                    loading={loading}
                    utc={false}
                    stacked
                    isLineChart
                    disableXAxis
                    hideYAxisSplitLine
                    chartColors={[theme.charts.getColorPalette(0)[0]]}
                    grid={{
                      left: '0',
                      right: '0',
                      top: '8px',
                      bottom: '16px',
                    }}
                  />
                </FlexRowItem>
                <FlexRowItem>
                  <SubHeader>{t('p50(duration)')}</SubHeader>
                  <SubSubHeader>
                    {getDuration(aggregateDetails.p50 / 1000, 0, true)}
                  </SubSubHeader>
                  <Chart
                    statsPeriod="24h"
                    height={110}
                    data={results?.[1] ? [results?.[1]] : []}
                    start=""
                    end=""
                    loading={loading}
                    utc={false}
                    stacked
                    isLineChart
                    disableXAxis
                    hideYAxisSplitLine
                    chartColors={[theme.charts.getColorPalette(0)[1]]}
                    grid={{
                      left: '0',
                      right: '0',
                      top: '8px',
                      bottom: '16px',
                    }}
                  />
                </FlexRowItem>
              </FlexRowContainer>
            </Fragment>
          );
        }}
      </EventsRequest>
      <FacetBreakdownBar
        segments={moduleBreakdown}
        title={t('Where is time spent in this endpoint?')}
        transaction={row.transaction}
      />
      <SubHeader>{t('HTTP Spans')}</SubHeader>
      <EndpointTable
        location={location}
        onSelect={r => {
          browserHistory.push(
            `/starfish/span/${encodeURIComponent(r.group_id)}/?${qs.stringify({
              transaction: row.transaction,
            })}`
          );
        }}
        columns={HTTP_SPAN_COLUMN_ORDER}
        filterOptions={{
          action: '',
          domain: '',
          transaction: row.transaction,
          datetime: pageFilter.selection.datetime,
        }}
      />
      <SubHeader>{t('Database Spans')}</SubHeader>
      <DatabaseTableView
        location={location}
        onSelect={r => {
          browserHistory.push(
            `/starfish/span/${encodeURIComponent(r.group_id)}/?${qs.stringify({
              transaction: row.transaction,
            })}`
          );
        }}
        isDataLoading={isTableDataLoading || isTableRefetching}
        data={tableData}
        columns={DATABASE_SPAN_COLUMN_ORDER}
      />
    </div>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0;
  margin-bottom: ${space(1)};
`;

const SubSubHeader = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

const FlexRowContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
`;

const FlexRowItem = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;
