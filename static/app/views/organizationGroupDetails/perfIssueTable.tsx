// import {Fragment} from 'react';
import {Location} from 'history';

import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import PerfEventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

export interface Props {
  issueId: string;
  location: Location;
  organization: Organization;
}

const PerfIssueTable = (props: Props) => {
  const eventView: EventView = EventView.fromSavedQuery({
    query: `performance.issue_ids:${props.issueId}`,
    fields: [
      'id',
      'transaction',
      'user.display',
      'span_ops_breakdown.relative',
      'transaction.duration',
      'trace',
      'timestamp',
      'spans.browser',
      'spans.db',
      'spans.http',
      'spans.resource',
      'spans.ui',
    ],
    id: undefined,
    name: 'All events',
    projects: [],
    version: 1,
  });

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
    <PerfEventsTable
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

export default PerfIssueTable;
