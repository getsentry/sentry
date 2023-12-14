import {useEffect, useMemo, useState} from 'react';
import {Location} from 'history';

import {getSampleEventQuery} from 'sentry/components/events/eventStatisticalDetector/eventComparison/eventDisplay';
import LoadingError from 'sentry/components/loadingError';
import {
  PlatformCategory,
  profiling as PROFILING_PLATFORMS,
} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {
  EventTransaction,
  Group,
  IssueCategory,
  IssueType,
  Organization,
  PlatformKey,
} from 'sentry/types';
import EventView, {decodeSorts} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {platformToCategory} from 'sentry/utils/platform';
import {useApiQuery} from 'sentry/utils/queryClient';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import {useRoutes} from 'sentry/utils/useRoutes';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

interface Props {
  group: Group;
  issueId: string;
  location: Location;
  organization: Organization;
  excludedTags?: string[];
}

const makeGroupPreviewRequestUrl = ({groupId}: {groupId: string}) => {
  return `/issues/${groupId}/events/latest/`;
};

function AllEventsTable(props: Props) {
  const {location, organization, issueId, excludedTags, group} = props;
  const config = getConfigForIssueType(props.group, group.project);
  const [error, setError] = useState<string>('');
  const routes = useRoutes();
  const {fields, columnTitles} = getColumns(group, organization);
  const now = useMemo(() => Date.now(), []);

  const endpointUrl = makeGroupPreviewRequestUrl({
    groupId: group.id,
  });

  const queryEnabled = group.issueCategory === IssueCategory.PERFORMANCE;
  const {data, isLoading, isLoadingError} = useApiQuery<EventTransaction>([endpointUrl], {
    staleTime: 60000,
    enabled: queryEnabled,
  });

  // TODO: this is a temporary way to check whether
  // perf issue is backed by occurrences or transactions
  // Once migration to the issue platform is complete a call to /latest should be removed
  const groupIsOccurrenceBacked = !!data?.occurrence;

  const eventView: EventView = EventView.fromLocation(props.location);
  if (
    config.usesIssuePlatform ||
    (group.issueCategory === IssueCategory.PERFORMANCE && groupIsOccurrenceBacked)
  ) {
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

  eventView.statsPeriod = '90d';

  const isRegressionIssue =
    group.issueType === IssueType.PERFORMANCE_DURATION_REGRESSION ||
    group.issueType === IssueType.PERFORMANCE_ENDPOINT_REGRESSION;

  let idQuery = `issue.id:${issueId}`;
  if (group.issueCategory === IssueCategory.PERFORMANCE && !groupIsOccurrenceBacked) {
    idQuery = `performance.issue_ids:${issueId} event.type:transaction`;
  } else if (isRegressionIssue && groupIsOccurrenceBacked) {
    const {transaction, aggregateRange2, breakpoint} =
      data?.occurrence?.evidenceData ?? {};

    // Surface the "bad" events that occur after the breakpoint
    idQuery = getSampleEventQuery({
      transaction,
      durationBaseline: aggregateRange2,
      addUpperBound: false,
    });

    eventView.dataset = DiscoverDatasets.DISCOVER;
    eventView.start = new Date(breakpoint * 1000).toISOString();
    eventView.end = new Date(now).toISOString();
    eventView.statsPeriod = undefined;
  }
  eventView.project = [parseInt(group.project.id, 10)];
  eventView.query = `${idQuery} ${props.location.query.query || ''}`;

  if (error || isLoadingError) {
    return (
      <LoadingError message={error || isLoadingError} onRetry={() => setError('')} />
    );
  }

  return (
    <EventsTable
      eventView={eventView}
      location={location}
      issueId={issueId}
      isRegressionIssue={isRegressionIssue}
      organization={organization}
      routes={routes}
      excludedTags={excludedTags}
      projectSlug={group.project.slug}
      customColumns={['minidump']}
      setError={(msg: string | undefined) => setError(msg ?? '')}
      transactionName=""
      columnTitles={columnTitles.slice()}
      referrer="api.issues.issue_events"
      isEventLoading={queryEnabled ? isLoading : false}
    />
  );
}

type ColumnInfo = {columnTitles: string[]; fields: string[]};

const getColumns = (group: Group, organization: Organization): ColumnInfo => {
  const isPerfIssue = group.issueCategory === IssueCategory.PERFORMANCE;
  const isReplayEnabled =
    organization.features.includes('session-replay') &&
    projectCanLinkToReplay(group.project);

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
  const backendServerlessColumnInfo = {
    fields: ['url', 'runtime'],
    columnTitles: [t('url'), t('runtime')],
  };

  const categoryToColumnMap: Record<PlatformCategory, ColumnInfo> = {
    [PlatformCategory.BACKEND]: backendServerlessColumnInfo,
    [PlatformCategory.SERVERLESS]: backendServerlessColumnInfo,
    [PlatformCategory.FRONTEND]: {
      fields: ['url', 'browser'],
      columnTitles: [t('url'), t('browser')],
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

  if (options.isReplayEnabled) {
    platformColumns.fields.push('replayId');
    platformColumns.columnTitles.push(t('replay'));
  }

  if (options.isProfilingEnabled && platform && PROFILING_PLATFORMS.includes(platform)) {
    platformColumns.columnTitles.push(t('profile'));
    platformColumns.fields.push('profile.id');
  }

  return platformColumns;
};

export default AllEventsTable;
