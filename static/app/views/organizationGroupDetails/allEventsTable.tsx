import {Location} from 'history';

import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

export interface Props {
  isPerfIssue: boolean;
  issueId: string;
  location: Location;
  organization: Organization;
}

const AllEventsTable = (props: Props) => {
  const {location, organization, issueId, isPerfIssue} = props;
  const eventView: EventView = EventView.fromLocation(props.location);

  eventView.fields = [
    {field: 'id'},
    {field: 'transaction'},
    {field: 'trace'},
    {field: 'release'},
    {field: 'environment'},
    {field: 'user.display'},
    ...(isPerfIssue ? [{field: 'transaction.duration'}] : []),
    {field: 'timestamp'},
  ];

  const idQuery = isPerfIssue
    ? `performance.issue_ids:${issueId}`
    : `issue.id:${issueId}`;
  eventView.query = `${idQuery} ${props.location.query.query || ''}`;

  const columnTitles: Readonly<string[]> = [
    t('event id'),
    t('transaction'),
    t('trace id'),
    t('release'),
    t('environment'),
    t('user'),
    ...(isPerfIssue ? [t('total duration')] : []),
    t('timestamp'),
  ];

  return (
    <EventsTable
      eventView={eventView}
      location={location}
      organization={organization}
      setError={() => {}}
      transactionName=""
      disablePagination
      columnTitles={columnTitles.slice()}
    />
  );
};

export default AllEventsTable;
