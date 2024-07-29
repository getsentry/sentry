import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {DeepPartial} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
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
import type {ProfilingFieldType} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {
  getProfilesTableFields,
  useProfileEvents,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import Tab from 'sentry/views/performance/transactionSummary/tabs';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

import PageLayout, {redirectToPerformanceHomepage} from '../pageLayout';

function ProfilesLegacy() {
  const location = useLocation();
  const organization = useOrganization();
  const projects = useProjects();

  const profilesCursor = useMemo(
    () => decodeScalar(location.query.cursor),
    [location.query.cursor]
  );

  const project = projects.projects.find(p => p.id === location.query.project);
  const fields = getProfilesTableFields(project?.platform);
  const sortableFields = useMemo(() => new Set(fields), [fields]);

  const sort = formatSort<ProfilingFieldType>(decodeScalar(location.query.sort), fields, {
    key: 'timestamp',
    order: 'desc',
  });

  const [query, setQuery] = useState(() => {
    // The search fields from the URL differ between profiling and
    // events dataset. For now, just drop everything except transaction
    const search = new MutableSearch('');
    const transaction = decodeScalar(location.query.transaction);

    if (defined(transaction)) {
      search.setFilterValues('transaction', [transaction]);
    }

    return search;
  });

  const profiles = useProfileEvents<ProfilingFieldType>({
    cursor: profilesCursor,
    fields,
    query: query.formatString(),
    sort,
    limit: 30,
    referrer: 'api.profiling.transactions-profiles-table',
  });

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      setQuery(new MutableSearch(searchQuery));
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchQuery || undefined,
        },
      });
    },
    [location]
  );

  const transaction = decodeScalar(location.query.transaction);

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects.projects}
      tab={Tab.PROFILING}
      generateEventView={() => EventView.fromLocation(location)}
      getDocumentTitle={() => t(`Profile: %s`, transaction)}
      childComponent={() => {
        return (
          <Layout.Main fullWidth>
            <FilterActions>
              <PageFilterBar condensed>
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <SearchBar
                searchSource="transaction_profiles"
                organization={organization}
                projectIds={projects.projects.map(p => parseInt(p.id, 10))}
                query={query.formatString()}
                onSearch={handleSearch}
                maxQueryLength={MAX_QUERY_LENGTH}
              />
            </FilterActions>
            <ProfileEventsTable
              columns={fields}
              data={profiles.status === 'success' ? profiles.data : null}
              error={profiles.status === 'error' ? t('Unable to load profiles') : null}
              isLoading={profiles.status === 'loading'}
              sort={sort}
              sortableColumns={sortableFields}
            />
          </Layout.Main>
        );
      }}
    />
  );
}

function ProfilesWrapper() {
  const organization = useOrganization();
  const location = useLocation();
  const transaction = decodeScalar(location.query.transaction);

  if (!transaction) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  return <Profiles organization={organization} transaction={transaction} />;
}

const DEFAULT_FLAMEGRAPH_PREFERENCES: DeepPartial<FlamegraphState> = {
  preferences: {
    sorting: 'alphabetical' satisfies FlamegraphState['preferences']['sorting'],
  },
};

const noop = () => void 0;

interface ProfilesProps {
  organization: Organization;
  transaction: string;
}

function Profiles({organization, transaction}: ProfilesProps) {
  const location = useLocation();
  const projects = useProjects();

  const rawQuery = decodeScalar(location.query.query, '');

  const query = useMemo(() => {
    const conditions = new MutableSearch(rawQuery);
    conditions.setFilterValues('event.type', ['transaction']);
    conditions.setFilterValues('transaction', [transaction]);

    Object.keys(conditions.filters).forEach(field => {
      if (isAggregateField(field)) {
        conditions.removeFilter(field);
      }
    });
    return conditions.formatString();
  }, [transaction, rawQuery]);

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchQuery || undefined,
        },
      });
    },
    [location]
  );

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

  const {data, isLoading, isError} = useAggregateFlamegraphQuery({
    query,
  });

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects.projects}
      tab={Tab.PROFILING}
      generateEventView={() => EventView.fromLocation(location)}
      getDocumentTitle={() => t(`Profile: %s`, transaction)}
      fillSpace
      childComponent={() => {
        return (
          <StyledMain fullWidth>
            <FilterActions>
              <PageFilterBar condensed>
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <StyledSearchBar
                searchSource="transaction_profiles"
                organization={organization}
                projectIds={projects.projects.map(p => parseInt(p.id, 10))}
                query={rawQuery}
                onSearch={handleSearch}
                maxQueryLength={MAX_QUERY_LENGTH}
              />
            </FilterActions>
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
                      {isLoading ? (
                        <RequestStateMessageContainer>
                          <LoadingIndicator />
                        </RequestStateMessageContainer>
                      ) : isError ? (
                        <RequestStateMessageContainer>
                          {t('There was an error loading the flamegraph.')}
                        </RequestStateMessageContainer>
                      ) : null}
                    </FlamegraphProvider>
                  </FlamegraphThemeProvider>
                </FlamegraphStateProvider>
              </ProfileGroupProvider>
            </ProfileVisualization>
          </StyledMain>
        );
      }}
    />
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

const FilterActions = styled('div')`
  margin-bottom: ${space(2)};
  gap: ${space(2)};
  display: grid;
  grid-template-columns: min-content 1fr;
`;

const StyledSearchBar = styled(SearchBar)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/4;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

const StyledMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const ProfileVisualization = styled('div')`
  display: grid;
  grid-template-rows: min-content 1fr;
  height: 100%;
  flex: 1;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
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

const FlamegraphContainer = styled('div')`
  overflow: hidden;
  display: flex;
`;

function ProfilesIndex() {
  const organization = useOrganization();

  if (organization.features.includes('continuous-profiling-compat')) {
    return <ProfilesWrapper />;
  }

  return <ProfilesLegacy />;
}

export default ProfilesIndex;
