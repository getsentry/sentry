import {useState} from 'react';
import {Location} from 'history';

import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView, {decodeSorts} from 'sentry/utils/discover/eventView';
import {useRoutes} from 'sentry/utils/useRoutes';
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
  const routes = useRoutes();

  const isReplayEnabled = organization.features.includes('session-replay-ui');
  const fields: string[] = [
    'id',
    'transaction',
    'trace',
    'release',
    'environment',
    'user.display',
    ...(isPerfIssue ? ['transaction.duration'] : []),
    'timestamp',
    ...(isReplayEnabled ? ['replayId'] : []),
  ];

  const eventView: EventView = EventView.fromLocation(props.location);
  eventView.fields = fields.map(fieldName => ({field: fieldName}));

  eventView.sorts = decodeSorts(location).filter(sort => fields.includes(sort.field));

  if (!eventView.sorts.length) {
    eventView.sorts = [{field: 'timestamp', kind: 'desc'}];
  }

  const idQuery = isPerfIssue
    ? `performance.issue_ids:${issueId} event.type:transaction`
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
    ...(isReplayEnabled ? [t('replay')] : []),
    t('minidump'),
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
      routes={routes}
      excludedTags={excludedTags}
      projectId={projectId}
      totalEventCount={totalEventCount}
      customColumns={['minidump']}
      setError={() => {
        (msg: string) => setError(msg);
      }}
      transactionName=""
      columnTitles={columnTitles.slice()}
      referrer="api.issues.issue_events"
    />
  );
};

export default AllEventsTable;
