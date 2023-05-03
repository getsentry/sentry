import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {SectionHeading} from 'sentry/components/charts/styles';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import Detail from 'sentry/views/starfish/components/detailPanel';
import FailureDetailTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/failureDetailTable';
import FocusedFailureRateChart from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/focusedFailureRateChart';
import IssueTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/issueTable';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

export default function FailureDetailPanel({
  chartData,
  spike,
  onClose,
}: {
  chartData: Series[];
  onClose: () => void;
  spike: FailureSpike;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const hasStartAndEnd = spike?.startTimestamp && spike.endTimestamp;

  function renderStatsOverview() {
    const transactionCountQuery: NewQuery = {
      name: t('Transaction Event Count'),
      projects: [],
      start: spike?.startTimestamp
        ? new Date(spike?.startTimestamp).toUTCString()
        : undefined,
      end: spike?.endTimestamp ? new Date(spike?.endTimestamp).toUTCString() : undefined,
      range: !hasStartAndEnd
        ? decodeScalar(location.query.statsPeriod) || DEFAULT_STATS_PERIOD
        : undefined,
      fields: ['count_if(http.status_code,greaterOrEquals,500)'],
      query: 'event.type:transaction',
      version: 2,
    };

    const errorCountQuery: NewQuery = {
      name: t('Error Event Count'),
      projects: [],
      start: spike?.startTimestamp
        ? new Date(spike?.startTimestamp).toUTCString()
        : undefined,
      end: spike?.endTimestamp ? new Date(spike?.endTimestamp).toUTCString() : undefined,
      range: !hasStartAndEnd
        ? decodeScalar(location.query.statsPeriod) || DEFAULT_STATS_PERIOD
        : undefined,
      fields: ['count()'],
      query: 'event.type:error',
      version: 2,
    };

    return (
      <OverviewStatsSection>
        <StatBlock>
          <SectionHeading>{t('Transaction Events')}</SectionHeading>
          <DiscoverQuery
            eventView={EventView.fromNewQueryWithLocation(
              transactionCountQuery,
              location
            )}
            orgSlug={organization.slug}
            location={location}
            referrer="api.starfish.failure-event-list"
            queryExtras={{dataset: 'discover'}}
          >
            {({isLoading, tableData}) => (
              <StatValue>
                {isLoading
                  ? '—'
                  : tableData?.data[0]['count_if(http.status_code,greaterOrEquals,500)']}
              </StatValue>
            )}
          </DiscoverQuery>
        </StatBlock>
        <StatBlock>
          <SectionHeading>{t('Error Events')}</SectionHeading>
          <DiscoverQuery
            eventView={EventView.fromNewQueryWithLocation(errorCountQuery, location)}
            orgSlug={organization.slug}
            location={location}
            referrer="api.starfish.failure-event-list"
            queryExtras={{dataset: 'discover'}}
          >
            {({isLoading, tableData}) => (
              <StatValue>{isLoading ? '—' : tableData?.data[0]['count()']}</StatValue>
            )}
          </DiscoverQuery>
        </StatBlock>
        <StatBlock>
          <SectionHeading>{t('Users')}</SectionHeading>
          {/** TODO: We need a count_unique_if() function to get the number of users who were affected by 5xx events
           * Need to implement this in Discover in the future, let's do this later.
           */}
          <StatValue>—</StatValue>
        </StatBlock>
      </OverviewStatsSection>
    );
  }

  const newQuery: NewQuery = {
    name: t('Failure Sample'),
    projects: [],
    start: spike?.startTimestamp
      ? new Date(spike?.startTimestamp).toUTCString()
      : undefined,
    end: spike?.endTimestamp ? new Date(spike?.endTimestamp).toUTCString() : undefined,
    range: !hasStartAndEnd
      ? decodeScalar(location.query.statsPeriod) || DEFAULT_STATS_PERIOD
      : undefined,
    fields: [
      'transaction',
      'count_if(http.status_code,greaterOrEquals,500)',
      'equation|count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500))',
      'http.method',
      'count_if(http.status_code,equals,200)',
    ],
    query:
      'event.type:transaction has:http.method transaction.op:http.server count_if(http.status_code,greaterOrEquals,500):>0',
    version: 2,
  };
  newQuery.orderby = '-count_if_http_status_code_greaterOrEquals_500';

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  return (
    <Detail detailKey={spike?.startTimestamp.toString()} onClose={onClose}>
      <TimeRangeHeading>{`${moment(spike?.startTimestamp).format(
        'MMMM Do YYYY, h:mm:ss a'
      )} - ${moment(spike?.endTimestamp).format(
        'MMMM Do YYYY, h:mm:ss a'
      )}`}</TimeRangeHeading>
      <h4>{t('Error Spike Detail')}</h4>

      {spike && (
        <DiscoverQuery
          eventView={eventView}
          orgSlug={organization.slug}
          location={location}
          referrer="api.starfish.failure-event-list"
          queryExtras={{dataset: 'discover'}}
          limit={5}
        >
          {results => {
            const transactions = results?.tableData?.data.map(row => row.transaction);
            return (
              <Fragment>
                {renderStatsOverview()}
                <FocusedFailureRateChart data={chartData} spike={spike} />
                <Title>{t('Failing Endpoints')}</Title>
                <FailureDetailTable
                  {...results}
                  location={location}
                  organization={organization}
                  eventView={eventView}
                />

                <Title>{t('Related Issues')}</Title>
                <IssueTable
                  location={location}
                  organization={organization}
                  isLoading={results.isLoading}
                  spike={spike}
                  transactions={transactions as string[]}
                />
              </Fragment>
            );
          }}
        </DiscoverQuery>
      )}
    </Detail>
  );
}

const Title = styled('h5')`
  margin-bottom: ${space(1)};
`;

const TimeRangeHeading = styled('div')`
  color: ${p => p.theme.red300};
  margin-bottom: ${space(4)};
`;

const OverviewStatsSection = styled('div')`
  display: flex;
  flex-direction: row;
  margin-bottom: ${space(2)};
`;

const StatBlock = styled('div')`
  display: flex;
  flex-direction: column;
  margin-right: ${space(4)};
  margin-bottom: 0;
`;

const StatValue = styled('div')`
  font-weight: 400;
  font-size: 22px;
`;
