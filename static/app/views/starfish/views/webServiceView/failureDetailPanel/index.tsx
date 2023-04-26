import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import Detail from 'sentry/views/starfish/components/detailPanel';
import FailureDetailTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/failureDetailTable';
import IssueTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/issueTable';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

export default function FailureDetailPanel({
  spike,
  onClose,
}: {
  onClose: () => void;
  spike: FailureSpike;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const hasStartAndEnd = spike?.startTimestamp && spike.endTimestamp;
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
      <h2>{t('Error Spike Detail')}</h2>
      <p>
        {t(
          'Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike.'
        )}
      </p>
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
