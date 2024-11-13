import {useEffect, useMemo, useState} from 'react';

import {getSampleEventQuery} from 'sentry/components/events/eventStatisticalDetector/eventComparison/eventDisplay';
import LoadingError from 'sentry/components/loadingError';
import {
  PlatformCategory,
  profiling as PROFILING_PLATFORMS,
} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {platformToCategory} from 'sentry/utils/platform';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeSorts} from 'sentry/utils/queryString';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import {useLocation} from 'sentry/utils/useLocation';
import {useRoutes} from 'sentry/utils/useRoutes';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

interface Props {
  excludedTags: string[];
  group: Group;
  organization: Organization;
}

const makeGroupPreviewRequestUrl = ({groupId}: {groupId: string}) => {
  return `/issues/${groupId}/events/latest/`;
};

function AllEventsTable({organization, excludedTags, group}: Props) {
  const location = useLocation();
  const config = getConfigForIssueType(group, group.project);
  const [error, setError] = useState<string>('');
  const routes = useRoutes();
  const {fields, columnTitles} = useEventColumns(group, organization);
  const now = useMemo(() => Date.now(), []);

  const endpointUrl = makeGroupPreviewRequestUrl({
    groupId: group.id,
  });

  const queryEnabled = group.issueCategory === IssueCategory.PERFORMANCE;
  const {data, isPending, isLoadingError} = useApiQuery<EventTransaction>([endpointUrl], {
    staleTime: 60000,
    enabled: queryEnabled,
  });

  // TODO: this is a temporary way to check whether
  // perf issue is backed by occurrences or transactions
  // Once migration to the issue platform is complete a call to /latest should be removed
  const groupIsOccurrenceBacked = !!data?.occurrence;

  const eventView: EventView = EventView.fromLocation(location);
  if (config.usesIssuePlatform) {
    eventView.dataset = DiscoverDatasets.ISSUE_PLATFORM;
  }
  eventView.fields = fields.map(fieldName => ({field: fieldName}));

  eventView.sorts = decodeSorts(location.query.sort).filter(sort =>
    fields.includes(sort.field)
  );

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

  let idQuery = `issue.id:${group.id}`;
  if (group.issueCategory === IssueCategory.PERFORMANCE && !groupIsOccurrenceBacked) {
    idQuery = `performance.issue_ids:${group.id} event.type:transaction`;
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
  eventView.query = `${idQuery} ${location.query.query || ''}`;

  if (error || isLoadingError) {
    return (
      <LoadingError message={error || isLoadingError} onRetry={() => setError('')} />
    );
  }

  return (
    <EventsTable
      eventView={eventView}
      location={location}
      issueId={group.id}
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
      isEventLoading={queryEnabled ? isPending : false}
    />
  );
}

type ColumnInfo = {columnTitles: string[]; fields: string[]};

export const useEventColumns = (group: Group, organization: Organization): ColumnInfo => {
  return useMemo(() => {
    const isPerfIssue = group.issueCategory === IssueCategory.PERFORMANCE;
    const isReplayEnabled =
      organization.features.includes('session-replay') &&
      projectCanLinkToReplay(organization, group.project);

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
      'timestamp',
      'title',
      'transaction',
      'release',
      'environment',
      'user.display',
      'device',
      'os',
      ...platformSpecificFields,
      'trace',
      ...(isPerfIssue ? ['transaction.duration'] : []),
    ];

    const columnTitles: string[] = [
      t('Event ID'),
      t('Timestamp'),
      t('Title'),
      t('Transaction'),
      t('Release'),
      t('Environment'),
      t('User'),
      t('Device'),
      t('OS'),
      ...platformSpecificColumnTitles,
      t('Trace'),
      ...(isPerfIssue ? [t('Total Duration')] : []),
      t('Minidump'),
    ];

    return {
      fields,
      columnTitles,
    };
  }, [group, organization]);
};

const getPlatformColumns = (
  platform: PlatformKey | undefined,
  options: {isProfilingEnabled: boolean; isReplayEnabled: boolean}
): ColumnInfo => {
  const backendServerlessColumnInfo = {
    fields: ['url', 'runtime'],
    columnTitles: [t('URL'), t('Runtime')],
  };

  const categoryToColumnMap: Record<PlatformCategory, ColumnInfo> = {
    [PlatformCategory.BACKEND]: backendServerlessColumnInfo,
    [PlatformCategory.SERVERLESS]: backendServerlessColumnInfo,
    [PlatformCategory.FRONTEND]: {
      fields: ['url', 'browser'],
      columnTitles: [t('URL'), t('Browser')],
    },
    [PlatformCategory.MOBILE]: {
      fields: ['url'],
      columnTitles: [t('URL')],
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
    platformColumns.columnTitles.push(t('Replay'));
  }

  if (options.isProfilingEnabled && platform && PROFILING_PLATFORMS.includes(platform)) {
    platformColumns.columnTitles.push(t('Profile'));
    platformColumns.fields.push('profile.id');
  }

  return platformColumns;
};

export default AllEventsTable;
