import {Location} from 'history';

import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

export interface Props {
  issueId: string;
  location: Location;
  organization: Organization;
}

const PerfEventsTable = (props: Props) => {
  const eventView: EventView = EventView.fromLocation(props.location);

  eventView.fields = [
    {field: 'id'},
    {field: 'transaction'},
    {field: 'trace'},
    {field: 'release'},
    {field: 'environment'},
    {field: 'user.display'},
    {field: 'transaction.duration'},
    {field: 'timestamp'},
  ];
  eventView.query = `performance.issue_ids:${props.issueId} ${
    props.location.query.query || ''
  }`;

  const columnTitles: Readonly<string[]> = [
    t('event id'),
    t('transaction'),
    t('trace id'),
    t('release'),
    t('environment'),
    t('user'),
    t('total duration'),
    t('timestamp'),
  ];

  return (
    <EventsTable
      eventView={eventView}
      location={props.location}
      organization={props.organization}
      setError={() => {}}
      transactionName=""
      disablePagination
      columnTitles={columnTitles.slice()}
    />
  );
};

export default PerfEventsTable;
