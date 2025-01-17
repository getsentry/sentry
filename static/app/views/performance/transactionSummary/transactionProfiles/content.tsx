import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {SectionHeading} from 'sentry/components/charts/styles';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconProfiling, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DeepPartial} from 'sentry/types/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import type {Frame} from 'sentry/utils/profiling/frame';
import {isEventedProfile, isSampledProfile} from 'sentry/utils/profiling/guards/profile';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import type {ProfilingFieldType} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

import {TraceViewSources} from '../../newTraceDetails/traceHeader/breadcrumbs';
import {generateProfileLink} from '../utils';

const DEFAULT_FLAMEGRAPH_PREFERENCES: DeepPartial<FlamegraphState> = {
  preferences: {
    sorting: 'left heavy' satisfies FlamegraphState['preferences']['sorting'],
  },
};

const noop = () => void 0;

interface TransactionProfilesContentProps {
  query: string;
  transaction: string;
}

export function TransactionProfilesContent(props: TransactionProfilesContentProps) {
  return (
    <TransactionProfilesContentContainer>
      <ProfileVisualization {...props} />
      <ProfileSidebarContainer>
        <ProfileDigest {...props} />
        <ProfileList {...props} />
      </ProfileSidebarContainer>
    </TransactionProfilesContentContainer>
  );
}

function isEmpty(resp: Profiling.Schema) {
  const profile = resp.profiles[0];
  if (!profile) {
    return true;
  }
  if (
    resp.profiles.length === 1 &&
    isSampledProfile(profile) &&
    profile.startValue === 0 &&
    profile.endValue === 0
  ) {
    return true;
  }
  if (
    resp.profiles.length === 1 &&
    isEventedProfile(profile) &&
    profile.startValue === 0 &&
    profile.endValue === 0
  ) {
    return true;
  }
  return false;
}

function ProfileVisualization(props: TransactionProfilesContentProps) {
  const {data, status} = useAggregateFlamegraphQuery({
    query: props.query,
  });

  const [frameFilter, setFrameFilter] = useLocalStorageState<
    'system' | 'application' | 'all'
  >('flamegraph-frame-filter', 'application');

  const onFrameFilterChange = useCallback(
    (value: 'system' | 'application' | 'all') => {
      setFrameFilter(value);
    },
    [setFrameFilter]
  );

  const onResetFrameFilter = useCallback(() => {
    setFrameFilter('all');
  }, [setFrameFilter]);

  const flamegraphFrameFilter: ((frame: Frame) => boolean) | undefined = useMemo(() => {
    if (frameFilter === 'all') {
      return () => true;
    }
    if (frameFilter === 'application') {
      return frame => frame.is_application;
    }
    return frame => !frame.is_application;
  }, [frameFilter]);

  const [visualization, setVisualization] = useLocalStorageState<
    'flamegraph' | 'call tree'
  >('flamegraph-visualization', 'flamegraph');

  const onVisualizationChange = useCallback(
    (value: 'flamegraph' | 'call tree') => {
      setVisualization(value);
    },
    [setVisualization]
  );

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  return (
    <ProfileVisualizationContainer>
      <ProfileGroupProvider
        traceID=""
        type="flamegraph"
        input={data ?? null}
        frameFilter={flamegraphFrameFilter}
      >
        <FlamegraphStateProvider initialState={DEFAULT_FLAMEGRAPH_PREFERENCES}>
          <FlamegraphThemeProvider>
            <FlamegraphProvider>
              <AggregateFlamegraphToolbar
                scheduler={scheduler}
                canvasPoolManager={canvasPoolManager}
                visualization={visualization}
                onVisualizationChange={onVisualizationChange}
                frameFilter={frameFilter}
                onFrameFilterChange={onFrameFilterChange}
                hideSystemFrames={false}
                setHideSystemFrames={noop}
              />
              <FlamegraphContainer>
                {visualization === 'flamegraph' ? (
                  <AggregateFlamegraph
                    status={status}
                    filter={frameFilter}
                    onResetFilter={onResetFrameFilter}
                    canvasPoolManager={canvasPoolManager}
                    scheduler={scheduler}
                  />
                ) : (
                  <AggregateFlamegraphTreeTable
                    recursion={null}
                    expanded={false}
                    frameFilter={frameFilter}
                    canvasPoolManager={canvasPoolManager}
                    withoutBorders
                  />
                )}
              </FlamegraphContainer>
              {status === 'pending' ? (
                <RequestStateMessageContainer>
                  <LoadingIndicator />
                </RequestStateMessageContainer>
              ) : status === 'error' ? (
                <RequestStateMessageContainer>
                  {t('There was an error loading the flamegraph.')}
                </RequestStateMessageContainer>
              ) : isEmpty(data) ? (
                <RequestStateMessageContainer>
                  {t('No profiling data found')}
                </RequestStateMessageContainer>
              ) : null}
            </FlamegraphProvider>
          </FlamegraphThemeProvider>
        </FlamegraphStateProvider>
      </ProfileGroupProvider>
    </ProfileVisualizationContainer>
  );
}

interface AggregateFlamegraphToolbarProps {
  canvasPoolManager: CanvasPoolManager;
  frameFilter: 'system' | 'application' | 'all';
  hideSystemFrames: boolean;
  onFrameFilterChange: (value: 'system' | 'application' | 'all') => void;
  onVisualizationChange: (value: 'flamegraph' | 'call tree') => void;
  scheduler: CanvasScheduler;
  setHideSystemFrames: (value: boolean) => void;
  visualization: 'flamegraph' | 'call tree';
}

function AggregateFlamegraphToolbar(props: AggregateFlamegraphToolbarProps) {
  const flamegraph = useFlamegraph();
  const flamegraphs = useMemo(() => [flamegraph], [flamegraph]);
  const spans = useMemo(() => [], []);

  const frameSelectOptions: SelectOption<'system' | 'application' | 'all'>[] =
    useMemo(() => {
      return [
        {value: 'system', label: t('System Frames')},
        {value: 'application', label: t('Application Frames')},
        {value: 'all', label: t('All Frames')},
      ];
    }, []);

  const onResetZoom = useCallback(() => {
    props.scheduler.dispatch('reset zoom');
  }, [props.scheduler]);

  const onFrameFilterChange = useCallback(
    (value: {value: 'application' | 'system' | 'all'}) => {
      props.onFrameFilterChange(value.value);
    },
    [props]
  );

  return (
    <AggregateFlamegraphToolbarContainer>
      <ViewSelectContainer>
        <SegmentedControl
          aria-label={t('View')}
          size="xs"
          value={props.visualization}
          onChange={props.onVisualizationChange}
        >
          <SegmentedControl.Item key="flamegraph">
            {t('Flamegraph')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="call tree">{t('Call Tree')}</SegmentedControl.Item>
        </SegmentedControl>
      </ViewSelectContainer>
      <AggregateFlamegraphSearch
        spans={spans}
        canvasPoolManager={props.canvasPoolManager}
        flamegraphs={flamegraphs}
      />
      <Button size="xs" onClick={onResetZoom}>
        {t('Reset Zoom')}
      </Button>
      <CompactSelect
        onChange={onFrameFilterChange}
        value={props.frameFilter}
        size="xs"
        options={frameSelectOptions}
      />
    </AggregateFlamegraphToolbarContainer>
  );
}

const PERCENTILE_DIGESTS = [
  'p50()',
  'p75()',
  'p95()',
  'p99()',
] satisfies ProfilingFieldType[];
const ALL_DIGESTS = [
  ...PERCENTILE_DIGESTS,
  'last_seen()',
  'count()',
] satisfies ProfilingFieldType[];

function ProfileDigest({query}: TransactionProfilesContentProps) {
  const profilesSummary = useProfileEvents<ProfilingFieldType>({
    fields: ALL_DIGESTS,
    query,
    sort: {key: 'last_seen()', order: 'desc'},
    referrer: 'api.profiling.profile-summary-table',
  });

  const digestData = profilesSummary.data?.data?.[0];

  return (
    <ProfileDigestContainer>
      <ProfileDigestLabel>{t('Last Seen')}</ProfileDigestLabel>
      <ProfileDigestValue align="right">
        {profilesSummary.isPending ? (
          ''
        ) : profilesSummary.isError ? (
          ''
        ) : (
          <DateTime date={new Date(digestData?.['last_seen()'] as string)} />
        )}
      </ProfileDigestValue>
      <ProfileDigestLabel>{t('Count')}</ProfileDigestLabel>
      <ProfileDigestValue align="right">
        {profilesSummary.isPending ? (
          ''
        ) : profilesSummary.isError ? (
          ''
        ) : (
          <Count value={digestData?.['count()'] as number} />
        )}
      </ProfileDigestValue>
      {PERCENTILE_DIGESTS.map(percentile => (
        <Fragment key={percentile}>
          <ProfileDigestLabel>
            {percentile.substring(0, percentile.length - 2)}
          </ProfileDigestLabel>
          <ProfileDigestValue align="right">
            {profilesSummary.isPending ? (
              ''
            ) : profilesSummary.isError ? (
              ''
            ) : (
              <PerformanceDuration
                milliseconds={digestData?.[percentile] as number}
                abbreviation
              />
            )}
          </ProfileDigestValue>
        </Fragment>
      ))}
    </ProfileDigestContainer>
  );
}

const ALLOWED_SORTS = [
  '-timestamp',
  'timestamp',
  '-transaction.duration',
  'transaction.duration',
] as const;
type SortOption = (typeof ALLOWED_SORTS)[number];

const sortOptions: SelectOption<SortOption>[] = [
  {value: '-timestamp', label: t('Newest Events')},
  {value: 'timestamp', label: t('Oldest Events')},
  {value: '-transaction.duration', label: t('Slowest Events')},
  {value: 'transaction.duration', label: t('Fastest Events')},
];

const PROFILES_SORT = 'profilesSort';
const PROFILES_CURSOR = 'profilesCursor';

function ProfileList({query: userQuery, transaction}: TransactionProfilesContentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const sortValue = useMemo(() => {
    const rawSort = decodeScalar(location.query[PROFILES_SORT]);
    if (ALLOWED_SORTS.includes(rawSort as any)) {
      return rawSort as SortOption;
    }
    return '-timestamp' as const;
  }, [location.query]);

  const sort = useMemo(() => {
    if (sortValue === '-timestamp') {
      return {key: 'timestamp', order: 'desc'} as const;
    }

    if (sortValue === 'timestamp') {
      return {key: 'timestamp', order: 'asc'} as const;
    }

    if (sortValue === '-transaction.duration') {
      return {key: 'transaction.duration', order: 'desc'} as const;
    }

    if (sortValue === 'transaction.duration') {
      return {key: 'transaction.duration', order: 'asc'} as const;
    }

    throw new Error(`Unsupport sort: ${sortValue}`);
  }, [sortValue]);

  const cursor = useMemo(
    () => decodeScalar(location.query[PROFILES_CURSOR]),
    [location.query]
  );

  const profilesList = useProfileEvents<ProfilingFieldType>({
    fields: [
      'id',
      'project.name',
      'trace',
      'transaction.duration',
      'profile.id',
      'profiler.id',
      'thread.id',
      'precise.start_ts',
      'precise.finish_ts',
      'timestamp',
    ],
    query: userQuery,
    sort,
    referrer: 'api.profiling.profile-summary-table',
    cursor,
    limit: 10,
  });

  const handleSort = useCallback(
    (value: {value: SortOption}) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          [PROFILES_SORT]: value.value,
          [PROFILES_CURSOR]: undefined,
        },
      });
    },
    [location, navigate]
  );

  const handleCursor = useCallback(
    // @ts-ignore TS(7006): Parameter 'newCursor' implicitly has an 'any' type... Remove this comment to see the full error message
    (newCursor, pathname, query) => {
      navigate({
        pathname,
        query: {...query, [PROFILES_CURSOR]: newCursor},
      });
    },
    [navigate]
  );

  return (
    <ProfileListContainer>
      <ProfileListControls>
        <CompactSelect
          onChange={handleSort}
          value={sortValue}
          size="xs"
          options={sortOptions}
        />
        <StyledPagination
          pageLinks={profilesList.getResponseHeader?.('Link')}
          onCursor={handleCursor}
          size="xs"
        />
      </ProfileListControls>
      {profilesList.isPending ? (
        <LoadingIndicator />
      ) : profilesList.isError ? (
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      ) : (
        <ProfileListResultsContainer>
          <ProfileDigestLabel>{t('Event ID')}</ProfileDigestLabel>
          <ProfileDigestLabel align="right">{t('Duration')}</ProfileDigestLabel>
          <ProfileDigestLabel align="right">{t('Profile')}</ProfileDigestLabel>
          {profilesList.data?.data?.map(row => {
            const traceTarget = generateLinkToEventInTraceView({
              eventId: row.id as string,
              timestamp: row.timestamp as string,
              traceSlug: row.trace as string,
              projectSlug: row['project.name'] as string,
              location,
              organization,
              transactionName: transaction,
              source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY_PROFILES,
            });

            const profileTarget = generateProfileLink()(
              organization,
              {
                id: row.id as string,
                'project.name': row['project.name'] as string,
                'profile.id': (row['profile.id'] as string) || '',
                'profiler.id': (row['profiler.id'] as string) || '',
                'thread.id': (row['thread.id'] as string) || '',
                'precise.start_ts': row['precise.start_ts'] as number,
                'precise.finish_ts': row['precise.finish_ts'] as number,
                trace: row.trace as string,
              },
              location
            );

            return (
              <Fragment key={row.id as string}>
                <ProfileDigestValue align="left">
                  <Link to={traceTarget}>{getShortEventId(row.id as string)}</Link>
                </ProfileDigestValue>
                <ProfileDigestValue align="right">
                  <PerformanceDuration
                    milliseconds={(row?.['transaction.duration'] as number) ?? 0}
                    abbreviation
                  />
                </ProfileDigestValue>
                <ProfileDigestValue align="right">
                  <LinkButton
                    disabled={!profileTarget || isEmptyObject(profileTarget)}
                    to={profileTarget || {}}
                    onClick={() => {
                      trackAnalytics('profiling_views.go_to_flamegraph', {
                        organization,
                        source: 'profiling_transaction.profiles_table',
                      });
                    }}
                    size="xs"
                  >
                    <IconProfiling size="xs" />
                  </LinkButton>
                </ProfileDigestValue>
              </Fragment>
            );
          })}
        </ProfileListResultsContainer>
      )}
    </ProfileListContainer>
  );
}

const TransactionProfilesContentContainer = styled('div')`
  display: grid;
  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: 'visualization digest';
  grid-template-columns: 1fr min-content;
  flex: 1;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const ProfileVisualizationContainer = styled('div')`
  grid-area: visualization;
  display: grid;
  grid-template-rows: min-content 1fr;
  height: 100%;
  position: relative;
`;

const FlamegraphContainer = styled('div')`
  display: flex;
`;

const RequestStateMessageContainer = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  pointer-events: none;
`;

const AggregateFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(1)};
  background-color: ${p => p.theme.background};
  /*
    force height to be the same as profile digest header,
    but subtract 1px for the border that doesnt exist on the header
   */
  height: 41px;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ViewSelectContainer = styled('div')`
  min-width: 160px;
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const ProfileSidebarContainer = styled('div')`
  grid-area: digest;
  border-left: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.background};
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-rows: min-content 1fr;
`;

const ProfileDigestContainer = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr;
  padding: ${space(2)};
  gap: ${space(1)};
`;

const ProfileListContainer = styled('div')`
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
`;

const ProfileListControls = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

const ProfileListResultsContainer = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr min-content;
  gap: ${space(1)};
`;

const ProfileDigestLabel = styled(SectionHeading)<{align?: 'left' | 'right'}>`
  margin: 0;
  text-transform: uppercase;
  text-wrap: nowrap;
  text-align: ${p => p.align ?? 'left'};
`;

const ProfileDigestValue = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
`;
