import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isNil from 'lodash/isNil';
import qs from 'qs';

import {Button} from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import FacetBreakdownBar from 'sentry/views/starfish/components/breakdownBar';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {HOST} from 'sentry/views/starfish/utils/constants';
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

function EndpointDetailBody({row, eventView, organization}: EndpointDetailBodyProps) {
  const theme = useTheme();
  const {aggregateDetails, transaction, httpOp} = row;

  const {data: moduleBreakdown} = useQuery({
    queryKey: [`moduleBreakdown${row.transaction}`],
    queryFn: () =>
      fetch(`${HOST}/?query=${getModuleBreakdown({transaction})}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const query = new MutableSearch([
    'has:http.method',
    'transaction.op:http.server',
    `transaction:${transaction}`,
    `http.method:${httpOp}`,
  ]);

  return (
    <div>
      <h2>{t('Endpoint Detail')}</h2>
      <p>{t('Details of endpoint. More breakdowns, etc. Maybe some trends?')}</p>
      <OverviewButton
        to={`/organizations/${
          organization.slug
        }/starfish/endpoint-overview/?${qs.stringify({
          endpoint: transaction,
          method: httpOp,
          statsPeriod: eventView.statsPeriod,
          project: eventView.project,
          start: eventView.start,
          end: eventView.end,
        })}`}
      >
        {t('Go to Endpoint Overview')}
      </OverviewButton>
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

const OverviewButton = styled(Button)`
  margin-bottom: ${space(2)};
`;
