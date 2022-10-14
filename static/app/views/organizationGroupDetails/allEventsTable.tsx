import {useState} from 'react';
import {Location} from 'history';

import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView, {decodeSorts} from 'sentry/utils/discover/eventView';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

export interface Props {
  isPerfIssue: boolean;
  issueId: string;
  location: Location;
  organization: Organization;
  projectId: string;
  excludedTags?: string[];
  totalEventCount?: string;
}

const AllEventsTable = (props: Props) => {
  const {
    location,
    organization,
    issueId,
    isPerfIssue,
    excludedTags,
    projectId,
    totalEventCount,
  } = props;
  const [error, setError] = useState<string>('');

  const fields: string[] = [
    'id',
    'transaction',
    'trace',
    'release',
    'environment',
    'user.display',
    ...(isPerfIssue ? ['transaction.duration'] : []),
    'timestamp',
    'attachments',
  ];

  const eventView: EventView = EventView.fromLocation(props.location);
  eventView.fields = fields.map(fieldName => ({field: fieldName}));

  eventView.sorts = decodeSorts(location).filter(sort => fields.includes(sort.field));

  const idQuery = isPerfIssue
    ? `performance.issue_ids:${issueId}`
    : `issue.id:${issueId}`;
  eventView.query = `${idQuery} ${props.location.query.query || ''}`;
  eventView.statsPeriod = '90d';

  const columnTitles: Readonly<string[]> = [
    t('event id'),
    t('transaction'),
    t('trace id'),
    t('release'),
    t('environment'),
    t('user'),
    ...(isPerfIssue ? [t('total duration')] : []),
    t('timestamp'),
    t('attachments'),
  ];

  if (error) {
    return <LoadingError message={error} />;
  }

  return (
    <EventsTable
      eventView={eventView}
      location={location}
      issueId={issueId}
      organization={organization}
      excludedTags={excludedTags}
      projectId={projectId}
      totalEventCount={totalEventCount}
      setError={() => {
        (msg: string) => setError(msg);
      }}
      transactionName=""
      columnTitles={columnTitles.slice()}
    />
  );
};

export default AllEventsTable;
