import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button, LinkButton} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import ErrorBoundary from 'sentry/components/errorBoundary';
import SearchBar from 'sentry/components/events/searchBar';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {
  ProfilingBreadcrumbs,
  ProfilingBreadcrumbsProps,
} from 'sentry/components/profiling/profilingBreadcrumbs';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {
  CanvasPoolManager,
  CanvasScheduler,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {Frame} from 'sentry/utils/profiling/frame';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {ProfilesSummaryChart} from 'sentry/views/profiling/landing/profilesSummaryChart';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {LegacySummaryPage} from 'sentry/views/profiling/profileSummary/legacySummaryPage';
import {DEFAULT_PROFILING_DATETIME_SELECTION} from 'sentry/views/profiling/utils';

import {MostRegressedProfileFunctions} from './regressedProfileFunctions';
import {SlowestProfileFunctions} from './slowestProfileFunctions';

interface ProfileSummaryHeaderProps {
  location: Location;
  organization: Organization;
  project: Project | null;
  query: string;
  transaction: string;
}
function ProfileSummaryHeader(props: ProfileSummaryHeaderProps) {
  const breadcrumbTrails: ProfilingBreadcrumbsProps['trails'] = useMemo(() => {
    return [
      {
        type: 'landing',
        payload: {
          query: props.location.query,
        },
      },
      {
        type: 'profile summary',
        payload: {
          projectSlug: props.project?.slug ?? '',
          query: props.location.query,
          transaction: props.transaction,
        },
      },
    ];
  }, [props.location.query, props.project?.slug, props.transaction]);

  const transactionSummaryTarget =
    props.project &&
    props.transaction &&
    transactionSummaryRouteWithQuery({
      orgSlug: props.organization.slug,
      transaction: props.transaction,
      projectID: props.project.id,
      query: {query: props.query},
    });

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <ProfilingBreadcrumbs
          organization={props.organization}
          trails={breadcrumbTrails}
        />
        <Layout.Title>
          {props.project ? (
            <IdBadge
              hideName
              project={props.project}
              avatarSize={28}
              avatarProps={{hasTooltip: true, tooltip: props.project.slug}}
            />
          ) : null}
          {props.transaction}
        </Layout.Title>
      </Layout.HeaderContent>
      {transactionSummaryTarget && (
        <Layout.HeaderActions>
          <LinkButton to={transactionSummaryTarget} size="sm">
            {t('View Transaction Summary')}
          </LinkButton>
        </Layout.HeaderActions>
      )}
    </Layout.Header>
  );
}

interface ProfileFiltersProps {
  location: Location;
  organization: Organization;
  projectIds: EventView['project'];
  query: string;
  selection: PageFilters;
  transaction: string | undefined;
  usingTransactions: boolean;
}

function ProfileFilters(props: ProfileFiltersProps) {
  const filtersQuery = useMemo(() => {
    // To avoid querying for the filters each time the query changes,
    // do not pass the user query to get the filters.
    const search = new MutableSearch('');

    if (defined(props.transaction)) {
      search.setFilterValues('transaction_name', [props.transaction]);
    }

    return search.formatString();
  }, [props.transaction]);

  const profileFilters = useProfileFilters({
    query: filtersQuery,
    selection: props.selection,
    disabled: props.usingTransactions,
  });

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...props.location,
        query: {
          ...props.location.query,
          query: searchQuery || undefined,
          cursor: undefined,
        },
      });
    },
    [props.location]
  );

  return (
    <ActionBar>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter alignDropdown="left" />
      </PageFilterBar>
      {props.usingTransactions ? (
        <SearchBar
          searchSource="profile_summary"
          organization={props.organization}
          projectIds={props.projectIds}
          query={props.query}
          onSearch={handleSearch}
          maxQueryLength={MAX_QUERY_LENGTH}
        />
      ) : (
        <SmartSearchBar
          organization={props.organization}
          hasRecentSearches
          searchSource="profile_summary"
          supportedTags={profileFilters}
          query={props.query}
          onSearch={handleSearch}
          maxQueryLength={MAX_QUERY_LENGTH}
        />
      )}
    </ActionBar>
  );
}

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: min-content auto;
  padding: ${space(1)} ${space(1)};
  background-color: ${p => p.theme.background};
`;

interface ProfileSummaryPageProps {
  location: Location;
  params: {
    projectId?: Project['slug'];
  };
  selection: PageFilters;
}

function ProfileSummaryPage(props: ProfileSummaryPageProps) {
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();

  const profilingUsingTransactions = organization.features.includes(
    'profiling-using-transactions'
  );

  const transaction = decodeScalar(props.location.query.transaction);

  if (!transaction) {
    throw new TypeError(
      `Profile summary requires a transaction query params, got ${
        transaction?.toString() ?? transaction
      }`
    );
  }

  const rawQuery = decodeScalar(props.location?.query?.query, '');

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

    if (defined(transaction)) {
      search.setFilterValues('transaction', [transaction]);
    }

    // there are no aggregations happening on this page,
    // so remove any aggregate filters
    Object.keys(search.filters).forEach(field => {
      if (isAggregateField(field)) {
        search.removeFilter(field);
      }
    });

    return search.formatString();
  }, [rawQuery, transaction]);

  const {data} = useAggregateFlamegraphQuery({transaction});

  const [visualization, setVisualization] = useLocalStorageState<
    'flamegraph' | 'call tree'
  >('flamegraph-visualization', 'flamegraph');

  const onVisualizationChange = useCallback(
    (value: 'flamegraph' | 'call tree') => {
      setVisualization(value);
    },
    [setVisualization]
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

  const flamegraphFrameFilter: ((frame: Frame) => boolean) | undefined = useMemo(() => {
    if (frameFilter === 'all') {
      return () => true;
    }
    if (frameFilter === 'application') {
      return frame => frame.is_application;
    }
    return frame => !frame.is_application;
  }, [frameFilter]);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

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
          defaultSelection={
            profilingUsingTransactions
              ? {datetime: DEFAULT_PROFILING_DATETIME_SELECTION}
              : undefined
          }
        >
          <ProfileSummaryHeader
            organization={organization}
            location={props.location}
            project={project}
            query={query}
            transaction={transaction}
          />
          <ProfileFilters
            projectIds={projectIds}
            organization={organization}
            location={props.location}
            query={rawQuery}
            selection={props.selection}
            transaction={transaction}
            usingTransactions={profilingUsingTransactions}
          />
          <ProfilesSummaryChart
            referrer="api.profiling.profile-summary-chart"
            query={query}
            hideCount
          />
          <ProfileVisualizationContainer>
            <ProfileVisualization>
              <ProfileGroupProvider
                type="flamegraph"
                input={data ?? null}
                traceID=""
                frameFilter={flamegraphFrameFilter}
              >
                <FlamegraphStateProvider
                  initialState={{
                    preferences: {
                      sorting: 'alphabetical',
                    },
                  }}
                >
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
                        setHideSystemFrames={() => void 0}
                      />
                      {visualization === 'flamegraph' ? (
                        <AggregateFlamegraph
                          canvasPoolManager={canvasPoolManager}
                          scheduler={scheduler}
                        />
                      ) : null}
                    </FlamegraphProvider>
                  </FlamegraphThemeProvider>
                </FlamegraphStateProvider>
              </ProfileGroupProvider>
            </ProfileVisualization>
            <ProfileDigest>
              <MostRegressedProfileFunctions transaction={transaction} />
              <SlowestProfileFunctions transaction={transaction} />
            </ProfileDigest>
          </ProfileVisualizationContainer>
        </PageFiltersContainer>
      </ProfileSummaryContainer>
    </SentryDocumentTitle>
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
      <SegmentedControl
        aria-label={t('View')}
        size="xs"
        value={props.visualization}
        onChange={props.onVisualizationChange}
      >
        <SegmentedControl.Item key="flamegraph">{t('Flamegraph')}</SegmentedControl.Item>
        <SegmentedControl.Item key="call tree">{t('Call Tree')}</SegmentedControl.Item>
      </SegmentedControl>
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

const AggregateFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(0.5)};
  background: ${p => p.theme.background};
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const ProfileVisualization = styled('div')`
  grid-area: visualization;
`;

const ProfileDigest = styled('div')`
  grid-area: digest;
`;

const ProfileVisualizationContainer = styled('div')`
  display: grid;
  grid-template-areas: 'visualization digest';
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

export default function ProfileSummaryPageToggle(props: ProfileSummaryPageProps) {
  const organization = useOrganization();

  if (organization.features.includes('profiling-summary-redesign')) {
    return (
      <ProfileSummaryContainer data-test-id="profile-summary-redesign">
        <ErrorBoundary>
          <ProfileSummaryPage {...props} />
        </ErrorBoundary>
      </ProfileSummaryContainer>
    );
  }

  return (
    <div data-test-id="profile-summary-legacy">
      <LegacySummaryPage {...props} />
    </div>
  );
}
