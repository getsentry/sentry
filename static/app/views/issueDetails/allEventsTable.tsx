import {useEffect, useState} from 'react';
import {Location} from 'history';

import LoadingError from 'sentry/components/loadingError';
import {
  PlatformCategory,
  PlatformKey,
  profiling as PROFILING_PLATFORMS,
} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {Group, IssueCategory, Organization} from 'sentry/types';
import EventView, {decodeSorts} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {platformToCategory} from 'sentry/utils/platform';
import {useRoutes} from 'sentry/utils/useRoutes';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

export interface Props {
  group: Group;
  issueId: string;
  location: Location;
  organization: Organization;
  excludedTags?: string[];
}

function AllEventsTable(props: Props) {
  const {location, organization, issueId, excludedTags, group} = props;
  const config = getConfigForIssueType(props.group);
  const [error, setError] = useState<string>('');
  const routes = useRoutes();
  const {fields, columnTitles} = getColumns(group, organization);

  const eventView: EventView = EventView.fromLocation(props.location);
  if (config.usesIssuePlatform) {
    eventView.dataset = DiscoverDatasets.ISSUE_PLATFORM;
  }
  eventView.fields = fields.map(fieldName => ({field: fieldName}));

  eventView.sorts = decodeSorts(location).filter(sort => fields.includes(sort.field));

  useEffect(() => {
    setError('');
  }, [eventView.query]);

  if (!eventView.sorts.length) {
    eventView.sorts = [{field: 'timestamp', kind: 'desc'}];
  }

  const idQuery =
    group.issueCategory === IssueCategory.PERFORMANCE
      ? `performance.issue_ids:${issueId} event.type:transaction`
      : `issue.id:${issueId}`;
  eventView.project = [parseInt(group.project.id, 10)];
  eventView.query = `${idQuery} ${props.location.query.query || ''}`;
  eventView.statsPeriod = '90d';

  if (error) {
    return <LoadingError message={error} onRetry={() => setError('')} />;
  }

  return (
    <EventsTable
      eventView={eventView}
      location={location}
      issueId={issueId}
      organization={organization}
      routes={routes}
      excludedTags={excludedTags}
      projectSlug={group.project.slug}
      customColumns={['minidump']}
      setError={(msg: string | undefined) => setError(msg ?? '')}
      transactionName=""
      columnTitles={columnTitles.slice()}
      referrer="api.issues.issue_events"
    />
  );
}

type ColumnInfo = {columnTitles: string[]; fields: string[]};

const getColumns = (group: Group, organization: Organization): ColumnInfo => {
  const isPerfIssue = group.issueCategory === IssueCategory.PERFORMANCE;
  const isReplayEnabled = organization.features.includes('session-replay');

  // profiles only exist on transactions, so this only works with
  // performance issues, and not errors
  const isProfilingEnabled = isPerfIssue && organization.features.includes('profiling');

  const {fields: platformSpecificFields, columnTitles: platformSpecificColumnTitles} =
    getPlatformColumns(group.project.platform ?? group.platform, {
      isProfilingEnabled,
      isReplayEnabled,
    });

  const fields: string[] = [
    'id',
    'transaction',
    'title',
    'release',
    'environment',
    'user.display',
    'device',
    'os',
    ...platformSpecificFields,
    ...(isPerfIssue ? ['transaction.duration'] : []),
    'timestamp',
  ];

  const columnTitles: string[] = [
    t('event id'),
    t('transaction'),
    t('title'),
    t('release'),
    t('environment'),
    t('user'),
    t('device'),
    t('os'),
    ...platformSpecificColumnTitles,
    ...(isPerfIssue ? [t('total duration')] : []),
    t('timestamp'),
    t('minidump'),
  ];

  return {
    fields,
    columnTitles,
  };
};

const getPlatformColumns = (
  platform: PlatformKey | undefined,
  options: {isProfilingEnabled: boolean; isReplayEnabled: boolean}
): ColumnInfo => {
  const replayField = options.isReplayEnabled ? ['replayId'] : [];
  const replayColumnTitle = options.isReplayEnabled ? [t('replay')] : [];

  const backendServerlessColumnInfo = {
    fields: ['url', 'runtime'],
    columnTitles: [t('url'), t('runtime')],
  };

  const categoryToColumnMap: Record<PlatformCategory, ColumnInfo> = {
    [PlatformCategory.BACKEND]: backendServerlessColumnInfo,
    [PlatformCategory.SERVERLESS]: backendServerlessColumnInfo,
    [PlatformCategory.FRONTEND]: {
      fields: ['url', 'browser', ...replayField],
      columnTitles: [t('url'), t('browser'), ...replayColumnTitle],
    },
    [PlatformCategory.MOBILE]: {
      fields: ['url'],
      columnTitles: [t('url')],
    },
    [PlatformCategory.DESKTOP]: {
      fields: [],
      columnTitles: [],
    },
    [PlatformCategory.OTHER]: {
      fields: [],
      columnTitles: [],
    },
  };

  const platformCategory = platformToCategory(platform);
  const platformColumns = categoryToColumnMap[platformCategory];

  if (options.isProfilingEnabled && platform && PROFILING_PLATFORMS.includes(platform)) {
    platformColumns.columnTitles.push(t('profile'));
    platformColumns.fields.push('profile.id');
  }

  return platformColumns;
};

export default AllEventsTable;
