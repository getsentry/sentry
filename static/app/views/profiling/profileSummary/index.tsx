import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import {Link} from 'sentry/components/core/link';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  DatePageFilter,
  type DatePageFilterProps,
} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import type {ProfilingBreadcrumbsProps} from 'sentry/components/profiling/profilingBreadcrumbs';
import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import type {DeepPartial} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import type {Frame} from 'sentry/utils/profiling/frame';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import type {ProfilingFieldType} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {ProfilesSummaryChart} from 'sentry/views/profiling/landing/profilesSummaryChart';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfilesTable} from 'sentry/views/profiling/profileSummary/profilesTable';

import {MostRegressedProfileFunctions} from './regressedProfileFunctions';
import {SlowestProfileFunctions} from './slowestProfileFunctions';

const PROFILE_TYPE = 'transaction aggregate flamegraph';

const noop = () => void 0;

function decodeViewOrDefault(
  value: string | string[] | null | undefined,
  defaultValue: 'flamegraph' | 'profiles'
): 'flamegraph' | 'profiles' {
  if (!value || Array.isArray(value)) {
    return defaultValue;
  }
  if (value === 'flamegraph' || value === 'profiles') {
    return value;
  }
  return defaultValue;
}

const DEFAULT_FLAMEGRAPH_PREFERENCES: DeepPartial<FlamegraphState> = {
  preferences: {
    sorting: 'alphabetical' satisfies FlamegraphState['preferences']['sorting'],
  },
};

interface ProfileSummaryHeaderProps {
  onViewChange: (newView: 'flamegraph' | 'profiles') => void;
  project: Project | null;
  query: string;
  transaction: string;
  view: 'flamegraph' | 'profiles';
}

function ProfileSummaryHeader(props: ProfileSummaryHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();

  const breadcrumbTrails: ProfilingBreadcrumbsProps['trails'] = useMemo(() => {
    return [
      {
        type: 'landing',
        payload: {
          query: location.query,
        },
      },
      {
        type: 'profile summary',
        payload: {
          projectSlug: props.project?.slug ?? '',
          query: location.query,
          transaction: props.transaction,
        },
      },
    ];
  }, [location.query, props.project?.slug, props.transaction]);

  const transactionSummaryTarget =
    props.project &&
    props.transaction &&
    transactionSummaryRouteWithQuery({
      organization,
      transaction: props.transaction,
      projectID: props.project.id,
      query: {query: props.query},
    });

  return (
    <ProfilingHeader>
      <ProfilingHeaderContent>
        <ProfilingBreadcrumbs organization={organization} trails={breadcrumbTrails} />
        <Layout.Title>
          <ProfilingTitleContainer>
            {props.project ? (
              <IdBadge
                hideName
                project={props.project}
                avatarSize={22}
                avatarProps={{hasTooltip: true, tooltip: props.project.slug}}
              />
            ) : null}
            {props.transaction}
          </ProfilingTitleContainer>
        </Layout.Title>
      </ProfilingHeaderContent>
      {transactionSummaryTarget && (
        <StyledHeaderActions>
          <FeedbackButton />
          <LinkButton to={transactionSummaryTarget} size="sm">
            {t('View Summary')}
          </LinkButton>
        </StyledHeaderActions>
      )}
      <Tabs onChange={props.onViewChange} value={props.view}>
        <TabList>
          <TabList.Item key="flamegraph">{t('Flamegraph')}</TabList.Item>
          <TabList.Item key="profiles">{t('Sampled Profiles')}</TabList.Item>
        </TabList>
      </Tabs>
    </ProfilingHeader>
  );
}

const ProfilingHeader = styled(Layout.Header)`
  padding: ${space(1)} ${space(2)} 0 ${space(2)} !important;
`;

const ProfilingHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: ${space(1)};

  h1 {
    line-height: normal;
  }
`;

const StyledHeaderActions = styled(Layout.HeaderActions)`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const ProfilingTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.lg};
`;

interface ProfileFiltersProps {
  datePageFilterProps: DatePageFilterProps;
  projectIds: EventView['project'];
  query: string;
}

function ProfileFilters(props: ProfileFiltersProps) {
  const location = useLocation();

  const handleSearch = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          query: searchQuery || undefined,
          cursor: undefined,
        },
      });
    },
    [location]
  );

  const projectIds = useMemo(() => props.projectIds.slice(), [props.projectIds]);

  return (
    <ActionBar>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter {...props.datePageFilterProps} />
      </PageFilterBar>
      <TransactionSearchQueryBuilder
        projects={projectIds}
        initialQuery={props.query}
        onSearch={handleSearch}
        searchSource="transaction_profiles"
      />
    </ActionBar>
  );
}

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: min-content auto;
  padding: ${space(1)} ${space(1)};
  background-color: ${p => p.theme.tokens.background.primary};
`;

function ProfileSummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();

  const transaction = decodeScalar(location.query.transaction);

  if (!transaction) {
    throw new TypeError(
      `Profile summary requires a transaction query params, got ${
        transaction?.toString() ?? transaction
      }`
    );
  }

  const rawQuery = decodeScalar(location?.query?.query, '');

  const projectIds: number[] = useMemo(() => {
    if (!defined(project)) {
      return [];
    }

    const projects = parseInt(project.id, 10);
    if (isNaN(projects)) {
      return [];
    }

    return [projects];
  }, [project]);

  const projectSlugs: string[] = useMemo(() => {
    return defined(project) ? [project.slug] : [];
  }, [project]);

  const query = useMemo(() => {
    const search = new MutableSearch(rawQuery);
    search.setFilterValues('transaction', [transaction]);

    // there are no aggregations happening on this page,
    // so remove any aggregate filters
    Object.keys(search.filters).forEach(field => {
      if (isAggregateField(field)) {
        search.removeFilter(field);
      }
    });

    return search.formatString();
  }, [rawQuery, transaction]);

  const {data, status} = useAggregateFlamegraphQuery({
    query,
  });

  const [visualization, setVisualization] = useLocalStorageState<
    'flamegraph' | 'call tree'
  >('flamegraph-visualization', 'flamegraph');

  const onVisualizationChange = useCallback(
    (value: 'flamegraph' | 'call tree') => {
      setVisualization(value);
    },
    [setVisualization]
  );

  const [hideRegressions, setHideRegressions] = useLocalStorageState<boolean>(
    'flamegraph-hide-regressions',
    false
  );
  const [frameFilter, setFrameFilter] = useLocalStorageState<
    'system' | 'application' | 'all'
  >('flamegraph-frame-filter', 'application');

  const onFrameFilterChange = useCallback(
    (value: 'system' | 'application' | 'all') => {
      setFrameFilter(value);
    },
    [setFrameFilter]
  );

  const flamegraphFrameFilter = useMemo((): ((frame: Frame) => boolean) => {
    if (frameFilter === 'all') {
      return () => true;
    }
    if (frameFilter === 'application') {
      return (frame: Frame) => frame.is_application;
    }
    return (frame: Frame) => !frame.is_application;
  }, [frameFilter]);

  const onResetFrameFilter = useCallback(() => {
    setFrameFilter('all');
  }, [setFrameFilter]);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const view = useMemo(() => {
    return decodeViewOrDefault(location.query.view, 'flamegraph');
  }, [location.query.view]);

  const setView = useCallback(
    (newView: 'flamegraph' | 'profiles') => {
      navigate({
        ...location,
        query: {
          ...location.query,
          view: newView,
        },
      });
    },
    [location, navigate]
  );

  const onHideRegressionsClick = useCallback(() => {
    return setHideRegressions(!hideRegressions);
  }, [hideRegressions, setHideRegressions]);

  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.PROFILE_DURATION, DataCategory.PROFILE_DURATION_UI],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <SentryDocumentTitle
      title={t('Profiling \u2014 Profile Summary')}
      orgSlug={organization.slug}
    >
      <ProfileSummaryContainer>
        <PageFiltersContainer
          shouldForceProject={defined(project)}
          forceProject={project}
          specificProjectSlugs={projectSlugs}
          maxPickableDays={datePageFilterProps.maxPickableDays}
          defaultSelection={
            datePageFilterProps.defaultPeriod
              ? {
                  datetime: {
                    period: datePageFilterProps.defaultPeriod,
                    start: null,
                    end: null,
                    utc: null,
                  },
                }
              : undefined
          }
        >
          <ProfileSummaryHeader
            view={view}
            onViewChange={setView}
            project={project}
            query={rawQuery}
            transaction={transaction}
          />
          <ProfileFilters
            projectIds={projectIds}
            query={rawQuery}
            datePageFilterProps={datePageFilterProps}
          />
          <ProfilesSummaryChart
            referrer="api.profiling.profile-summary-chart"
            query={query}
            hideCount
          />
          {view === 'profiles' ? (
            <ProfilesTable />
          ) : (
            <ProfileVisualizationContainer hideRegressions={hideRegressions}>
              <ProfileVisualization>
                <ProfileGroupProvider
                  traceID=""
                  type="flamegraph"
                  input={data ?? null}
                  frameFilter={flamegraphFrameFilter}
                >
                  <FlamegraphStateProvider initialState={DEFAULT_FLAMEGRAPH_PREFERENCES}>
                    <FlamegraphThemeProvider>
                      <FlamegraphProvider>
                        <AggregateFlamegraphContainer>
                          <AggregateFlamegraphToolbar
                            scheduler={scheduler}
                            canvasPoolManager={canvasPoolManager}
                            visualization={visualization}
                            onVisualizationChange={onVisualizationChange}
                            frameFilter={frameFilter}
                            onFrameFilterChange={onFrameFilterChange}
                            hideSystemFrames={false}
                            setHideSystemFrames={noop}
                            onHideRegressionsClick={onHideRegressionsClick}
                          />
                          {status === 'pending' ? (
                            <RequestStateMessageContainer>
                              <LoadingIndicator />
                            </RequestStateMessageContainer>
                          ) : status === 'error' ? (
                            <RequestStateMessageContainer>
                              {t('There was an error loading the flamegraph.')}
                            </RequestStateMessageContainer>
                          ) : null}
                          {visualization === 'flamegraph' ? (
                            <AggregateFlamegraph
                              filter={frameFilter}
                              canvasPoolManager={canvasPoolManager}
                              scheduler={scheduler}
                              status={status}
                              onResetFilter={onResetFrameFilter}
                              profileType={PROFILE_TYPE}
                            />
                          ) : (
                            <AggregateFlamegraphTreeTable
                              recursion={null}
                              expanded={false}
                              frameFilter={frameFilter}
                              canvasPoolManager={canvasPoolManager}
                              profileType={PROFILE_TYPE}
                            />
                          )}
                        </AggregateFlamegraphContainer>
                      </FlamegraphProvider>
                    </FlamegraphThemeProvider>
                  </FlamegraphStateProvider>
                </ProfileGroupProvider>
              </ProfileVisualization>
              {hideRegressions ? null : (
                <ProfileDigestContainer>
                  <ProfileDigestScrollContainer>
                    <ProfileDigest onViewChange={setView} transaction={transaction} />
                    <MostRegressedProfileFunctions transaction={transaction} />
                    <SlowestProfileFunctions transaction={transaction} />
                  </ProfileDigestScrollContainer>
                </ProfileDigestContainer>
              )}
            </ProfileVisualizationContainer>
          )}
        </PageFiltersContainer>
      </ProfileSummaryContainer>
    </SentryDocumentTitle>
  );
}

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
`;

const AggregateFlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  height: 100%;
  width: 100%;
  position: absolute;
  left: 0px;
  top: 0px;
`;

interface AggregateFlamegraphToolbarProps {
  canvasPoolManager: CanvasPoolManager;
  frameFilter: 'system' | 'application' | 'all';
  hideSystemFrames: boolean;
  onFrameFilterChange: (value: 'system' | 'application' | 'all') => void;
  onHideRegressionsClick: () => void;
  onVisualizationChange: (value: 'flamegraph' | 'call tree') => void;
  scheduler: CanvasScheduler;
  setHideSystemFrames: (value: boolean) => void;
  visualization: 'flamegraph' | 'call tree';
}

function AggregateFlamegraphToolbar(props: AggregateFlamegraphToolbarProps) {
  const flamegraph = useFlamegraph();
  const flamegraphs = useMemo(() => [flamegraph], [flamegraph]);
  const spans = useMemo(() => [], []);

  const frameSelectOptions: Array<SelectOption<'system' | 'application' | 'all'>> =
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
      <Button
        size="xs"
        onClick={props.onHideRegressionsClick}
        title={t('Expand or collapse the view')}
      >
        <IconPanel size="xs" direction="right" />
      </Button>
    </AggregateFlamegraphToolbarContainer>
  );
}

const ViewSelectContainer = styled('div')`
  min-width: 160px;
`;

const AggregateFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(1)} ${space(0.5)};
  /*
    force height to be the same as profile digest header,
    but subtract 1px for the border that doesnt exist on the header
   */
  height: 41px;
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const ProfileVisualization = styled('div')`
  grid-area: visualization;
  position: relative;
  height: 100%;
`;

const ProfileDigestContainer = styled('div')`
  grid-area: digest;
  border-left: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.tokens.background.primary};
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  position: relative;
  overflow: hidden;
`;

const ProfileDigestScrollContainer = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
`;

// @ts-expect-error TS(7008): Member 'hideRegressions' implicitly has an 'any' t... Remove this comment to see the full error message
const ProfileVisualizationContainer = styled('div')<{hideRegressions}>`
  display: grid;
  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${p =>
    p.hideRegressions ? "'visualization'" : "'visualization digest'"};
  grid-template-columns: ${p => (p.hideRegressions ? `100%` : `60% 40%`)};
  flex: 1 1 100%;
`;

const ProfileSummaryContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;

  /*
   * The footer component is a sibling of this div.
   * Remove it so the flamegraph can take up the
   * entire screen.
   */
  ~ footer {
    display: none;
  }
`;

const PROFILE_DIGEST_FIELDS = [
  'last_seen()',
  'p75()',
  'p95()',
  'p99()',
  'count()',
] satisfies ProfilingFieldType[];

const percentiles = ['p75()', 'p95()', 'p99()'] as const;

interface ProfileDigestProps {
  onViewChange: (newView: 'flamegraph' | 'profiles') => void;
  transaction: string;
}

function ProfileDigest(props: ProfileDigestProps) {
  const location = useLocation();
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();

  const query = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('transaction', [props.transaction]);
    return conditions.formatString();
  }, [props.transaction]);

  const profilesCursor = useMemo(
    () => decodeScalar(location.query.cursor),
    [location.query.cursor]
  );

  const profiles = useProfileEvents<ProfilingFieldType>({
    cursor: profilesCursor,
    fields: PROFILE_DIGEST_FIELDS,
    query,
    sort: {key: 'last_seen()', order: 'desc'},
    referrer: 'api.profiling.profile-summary-table',
  });
  const data = profiles.data?.data?.[0];

  const latestProfile = useProfileEvents<ProfilingFieldType>({
    cursor: profilesCursor,
    fields: ['profile.id', 'timestamp'],
    query: '',
    sort: {key: 'timestamp', order: 'desc'},
    limit: 1,
    referrer: 'api.profiling.profile-summary-table',
  });
  const profile = latestProfile.data?.data?.[0];

  const flamegraphTarget =
    project && profile
      ? generateProfileFlamechartRoute({
          organization,
          projectSlug: project.slug,
          profileId: profile?.['profile.id'] as string,
        })
      : undefined;

  return (
    <ProfileDigestHeader>
      <div>
        <ProfileDigestLabel>{t('Last Seen')}</ProfileDigestLabel>
        <div>
          {profiles.isPending ? (
            ''
          ) : profiles.isError ? (
            ''
          ) : flamegraphTarget ? (
            <Link to={flamegraphTarget}>
              <DateTime date={new Date(data?.['last_seen()'] as string)} />
            </Link>
          ) : (
            <DateTime date={new Date(data?.['last_seen()'] as string)} />
          )}
        </div>
      </div>

      {percentiles.map(p => {
        return (
          <ProfileDigestColumn key={p}>
            <ProfileDigestLabel>{p}</ProfileDigestLabel>
            <div>
              {profiles.isPending ? (
                ''
              ) : profiles.isError ? (
                ''
              ) : (
                <PerformanceDuration nanoseconds={data?.[p] as number} abbreviation />
              )}
            </div>
          </ProfileDigestColumn>
        );
      })}
      <ProfileDigestColumn>
        <ProfileDigestLabel>{t('profiles')}</ProfileDigestLabel>
        <div>
          {profiles.isPending ? (
            ''
          ) : profiles.isError ? (
            ''
          ) : (
            <Count value={data?.['count()'] as number} />
          )}
        </div>
      </ProfileDigestColumn>
    </ProfileDigestHeader>
  );
}

const ProfileDigestColumn = styled('div')`
  text-align: right;
`;

const ProfileDigestHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
  /* force height to be same as toolbar */
  height: 42px;
  flex-shrink: 0;
`;

const ProfileDigestLabel = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-transform: uppercase;
`;

export default function ProfileSummaryPageToggle() {
  return (
    <ProfileSummaryContainer data-test-id="profile-summary-redesign">
      <ErrorBoundary>
        <ProfileSummaryPage />
      </ErrorBoundary>
    </ProfileSummaryContainer>
  );
}
