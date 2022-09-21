// import {Fragment} from 'react';
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
  const eventView: EventView = EventView.fromSavedQueryOrLocation(
    undefined,
    props.location
  );

  eventView.fields = [
    {field: 'id'},
    {field: 'transaction'},
    {field: 'user.display'},
    {field: 'span_ops_breakdown.relative'},
    {field: 'transaction.duration'},
    {field: 'trace'},
    {field: 'timestamp'},
    {field: 'spans.browser'},
    {field: 'spans.db'},
    {field: 'spans.http'},
    {field: 'spans.resource'},
    {field: 'spans.ui'},
  ];
  eventView.query = `performance.issue_ids:${props.issueId}`;

  const columnTitles: Readonly<string[]> = [
    t('event id'),
    t('transaction'),
    t('user'),
    t('operation duration'),
    t('total duration'),
    t('trace id'),
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
