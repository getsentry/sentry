import {
  cloneElement,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import MissingProjectMembership from 'sentry/components/projects/missingProjectMembership';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TabPanels, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import {
  Group,
  GroupStatus,
  IssueCategory,
  IssueType,
  Organization,
  Project,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getMessage,
  getTitle,
} from 'sentry/utils/events';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {
  ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import recreateRoute from 'sentry/utils/recreateRoute';
import RequestError from 'sentry/utils/requestError/requestError';
import useDisableRouteAnalytics from 'sentry/utils/routeAnalytics/useDisableRouteAnalytics';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {ERROR_TYPES} from './constants';
import GroupHeader from './header';
import SampleEventAlert from './sampleEventAlert';
import {Tab, TabPaths} from './types';
import {
  getGroupDetailsQueryData,
  getGroupEventDetailsQueryData,
  getGroupReprocessingStatus,
  markEventSeen,
  ReprocessingStatus,
  useDefaultIssueEvent,
  useEnvironmentsFromUrl,
  useFetchIssueTagsForDetailsPage,
} from './utils';

type Error = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES] | null;

type RouterParams = {groupId: string; eventId?: string};
type RouteProps = RouteComponentProps<RouterParams, {}>;

interface GroupDetailsProps extends RouteComponentProps<{groupId: string}, {}> {
  children: React.ReactNode;
}

type FetchGroupDetailsState = {
  error: boolean;
  errorType: Error;
  event: Event | null;
  eventError: boolean;
  group: Group | null;
  loadingEvent: boolean;
  loadingGroup: boolean;
  refetchData: () => void;
  refetchGroup: () => void;
};

interface GroupDetailsContentProps extends GroupDetailsProps, FetchGroupDetailsState {
  group: Group;
  project: Project;
}

function getFetchDataRequestErrorType(status?: number | null): Error {
  if (!status) {
    return null;
  }

  if (status === 404) {
    return ERROR_TYPES.GROUP_NOT_FOUND;
  }

  if (status === 403) {
    return ERROR_TYPES.MISSING_MEMBERSHIP;
  }

  return null;
}

function getCurrentTab({router}: {router: RouteProps['router']}) {
  const currentRoute = router.routes[router.routes.length - 1];

  // If we're in the tag details page ("/tags/:tagKey/")
  if (router.params.tagKey) {
    return Tab.TAGS;
  }
  return (
    Object.values(Tab).find(tab => currentRoute.path === TabPaths[tab]) ?? Tab.DETAILS
  );
}

function getCurrentRouteInfo({
  group,
  event,
  organization,
  router,
}: {
  event: Event | null;
  group: Group;
  organization: Organization;
  router: RouteProps['router'];
}): {
  baseUrl: string;
  currentTab: Tab;
} {
  const currentTab = getCurrentTab({router});

  const baseUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${group.id}/${
      router.params.eventId && event ? `events/${event.id}/` : ''
    }`
  );

  return {baseUrl, currentTab};
}

function getReprocessingNewRoute({
  group,
  event,
  organization,
  router,
}: {
  event: Event | null;
  group: Group;
  organization: Organization;
  router: RouteProps['router'];
}) {
  const {routes, params, location} = router;
  const {groupId} = params;
  const {currentTab, baseUrl} = getCurrentRouteInfo({group, event, organization, router});
  const hasReprocessingV2Feature = organization.features?.includes('reprocessing-v2');

  const {id: nextGroupId} = group;

  const reprocessingStatus = getGroupReprocessingStatus(group);

  if (groupId !== nextGroupId) {
    if (hasReprocessingV2Feature) {
      // Redirects to the Activities tab
      if (
        reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT &&
        currentTab !== Tab.ACTIVITY
      ) {
        return {
          pathname: `${baseUrl}${Tab.ACTIVITY}/`,
          query: {...params, groupId: nextGroupId},
        };
      }
    }

    return recreateRoute('', {
      routes,
      location,
      params: {...params, groupId: nextGroupId},
    });
  }

  if (hasReprocessingV2Feature) {
    if (
      reprocessingStatus === ReprocessingStatus.REPROCESSING &&
      currentTab !== Tab.DETAILS
    ) {
      return {
        pathname: baseUrl,
        query: params,
      };
    }

    if (
      reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT &&
      currentTab !== Tab.ACTIVITY &&
      currentTab !== Tab.USER_FEEDBACK
    ) {
      return {
        pathname: `${baseUrl}${Tab.ACTIVITY}/`,
        query: params,
      };
    }
  }
  return undefined;
}

function useRefetchGroupForReprocessing({
  refetchGroup,
}: Pick<FetchGroupDetailsState, 'refetchGroup'>) {
  const organization = useOrganization();
  const hasReprocessingV2Feature = organization.features?.includes('reprocessing-v2');

  useEffect(() => {
    let refetchInterval: number;

    if (hasReprocessingV2Feature) {
      refetchInterval = window.setInterval(refetchGroup, 30000);
    }

    return () => {
      window.clearInterval(refetchInterval);
    };
  }, [hasReprocessingV2Feature, refetchGroup]);
}

function useEventApiQuery({
  groupId,
  eventId,
  environments,
}: {
  environments: string[];
  groupId: string;
  eventId?: string;
}) {
  const organization = useOrganization();
  const location = useLocation<{query?: string}>();
  const router = useRouter();
  const defaultIssueEvent = useDefaultIssueEvent();
  const eventIdUrl = eventId ?? defaultIssueEvent;
  const recommendedEventQuery =
    typeof location.query.query === 'string' ? location.query.query : undefined;

  const queryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/issues/${groupId}/events/${eventIdUrl}/`,
    {
      query: getGroupEventDetailsQueryData({
        environments,
        query: recommendedEventQuery,
      }),
    },
  ];

  const tab = getCurrentTab({router});
  const isOnDetailsTab = tab === Tab.DETAILS;

  const isLatestOrRecommendedEvent =
    eventIdUrl === 'latest' || eventIdUrl === 'recommended';
  const latestOrRecommendedEvent = useApiQuery<Event>(queryKey, {
    // Latest/recommended event will change over time, so only cache for 30 seconds
    staleTime: 30000,
    cacheTime: 30000,
    enabled: isOnDetailsTab && isLatestOrRecommendedEvent,
    retry: false,
  });
  const otherEventQuery = useApiQuery<Event>(queryKey, {
    // Oldest/specific events will never change
    staleTime: Infinity,
    enabled: isOnDetailsTab && !isLatestOrRecommendedEvent,
    retry: false,
  });

  useEffect(() => {
    if (latestOrRecommendedEvent.isError) {
      // If we get an error from the helpful event endpoint, it probably means
      // the query failed validation. We should remove the query to try again.
      browserHistory.replace({
        ...window.location,
        query: omit(qs.parse(window.location.search), 'query'),
      });

      // 404s are expected if all events have exceeded retention
      if (latestOrRecommendedEvent.error.status === 404) {
        return;
      }

      const scope = new Sentry.Scope();
      scope.setExtras({
        groupId,
        query: recommendedEventQuery,
        ...pick(latestOrRecommendedEvent.error, ['message', 'status', 'responseJSON']),
      });
      scope.setFingerprint(['issue-details-helpful-event-request-failed']);
      Sentry.captureException(
        new Error('Issue Details: Helpful event request failed'),
        scope
      );
    }
  }, [
    latestOrRecommendedEvent.isError,
    latestOrRecommendedEvent.error,
    groupId,
    recommendedEventQuery,
  ]);

  return isLatestOrRecommendedEvent ? latestOrRecommendedEvent : otherEventQuery;
}

type FetchGroupQueryParameters = {
  environments: string[];
  groupId: string;
  organizationSlug: string;
};

function makeFetchGroupQueryKey({
  groupId,
  organizationSlug,
  environments,
}: FetchGroupQueryParameters): ApiQueryKey {
  return [
    `/organizations/${organizationSlug}/issues/${groupId}/`,
    {query: getGroupDetailsQueryData({environments})},
  ];
}

/**
 * This is a temporary measure to ensure that the GroupStore and query cache
 * are both up to date while we are still using both in the issue details page.
 * Once we remove all references to GroupStore in the issue details page we
 * should remove this.
 */
function useSyncGroupStore(incomingEnvs: string[]) {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const environmentsRef = useRef<string[]>(incomingEnvs);
  environmentsRef.current = incomingEnvs;

  const unlisten = useRef<Function>();
  if (unlisten.current === undefined) {
    unlisten.current = GroupStore.listen(() => {
      const [storeGroup] = GroupStore.getState();
      const environments = environmentsRef.current;
      if (defined(storeGroup)) {
        setApiQueryData(
          queryClient,
          makeFetchGroupQueryKey({
            groupId: storeGroup.id,
            organizationSlug: organization.slug,
            environments,
          }),
          storeGroup
        );
      }
    }, undefined);
  }

  useEffect(() => {
    return () => unlisten.current?.();
  }, []);
}

function useFetchGroupDetails(): FetchGroupDetailsState {
  const api = useApi();
  const organization = useOrganization();
  const router = useRouter();
  const params = router.params;

  const [error, setError] = useState<boolean>(false);
  const [errorType, setErrorType] = useState<Error | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [allProjectChanged, setAllProjectChanged] = useState<boolean>(false);

  const environments = useEnvironmentsFromUrl();

  const groupId = params.groupId;

  const {
    data: eventData,
    isLoading: loadingEvent,
    isError,
    refetch: refetchEvent,
  } = useEventApiQuery({
    groupId,
    eventId: params.eventId,
    environments,
  });

  const {
    data: groupData,
    isLoading: loadingGroup,
    isError: isGroupError,
    error: groupError,
    refetch: refetchGroupCall,
  } = useApiQuery<Group>(
    makeFetchGroupQueryKey({organizationSlug: organization.slug, groupId, environments}),
    {
      staleTime: 30000,
      cacheTime: 30000,
      retry: false,
    }
  );

  const group = groupData ?? null;

  useEffect(() => {
    if (defined(group)) {
      GroupStore.loadInitialData([group]);
    }
  }, [groupId, group]);

  useSyncGroupStore(environments);

  useEffect(() => {
    if (eventData) {
      setEvent(eventData);
    }
  }, [eventData]);

  useEffect(() => {
    if (group && event) {
      const reprocessingNewRoute = getReprocessingNewRoute({
        group,
        event,
        router,
        organization,
      });

      if (reprocessingNewRoute) {
        browserHistory.push(reprocessingNewRoute);
        return;
      }
    }
  }, [group, event, router, organization]);

  useEffect(() => {
    const matchingProjectSlug = group?.project?.slug;

    if (!matchingProjectSlug) {
      return;
    }

    if (!group.hasSeen) {
      markEventSeen(api, organization.slug, matchingProjectSlug, params.groupId);
    }
  }, [
    api,
    group?.hasSeen,
    group?.project?.id,
    group?.project?.slug,
    organization.slug,
    params.groupId,
  ]);

  const allProjectsFlag = router.location.query._allp;

  useEffect(() => {
    const locationQuery = qs.parse(window.location.search) || {};

    // We use _allp as a temporary measure to know they came from the
    // issue list page with no project selected (all projects included in
    // filter).
    //
    // If it is not defined, we add the locked project id to the URL
    // (this is because if someone navigates directly to an issue on
    // single-project priveleges, then goes back - they were getting
    // assigned to the first project).
    //
    // If it is defined, we do not so that our back button will bring us
    // to the issue list page with no project selected instead of the
    // locked project.
    if (
      locationQuery.project === undefined &&
      !allProjectsFlag &&
      !allProjectChanged &&
      group?.project.id
    ) {
      locationQuery.project = group?.project.id;
      browserHistory.replace({...window.location, query: locationQuery});
    }

    if (allProjectsFlag && !allProjectChanged) {
      delete locationQuery.project;
      // We delete _allp from the URL to keep the hack a bit cleaner, but
      // this is not an ideal solution and will ultimately be replaced with
      // something smarter.
      delete locationQuery._allp;
      browserHistory.replace({...window.location, query: locationQuery});
      setAllProjectChanged(true);
    }
  }, [allProjectsFlag, group?.project.id, allProjectChanged]);

  const handleError = useCallback((e: RequestError) => {
    Sentry.captureException(e);

    setErrorType(getFetchDataRequestErrorType(e?.status));
    setError(true);
  }, []);

  useEffect(() => {
    if (isGroupError) {
      handleError(groupError);
    }
  }, [isGroupError, groupError, handleError]);

  const refetchGroup = useCallback(() => {
    if (group?.status !== GroupStatus.REPROCESSING || loadingGroup || loadingEvent) {
      return;
    }

    refetchGroupCall();
  }, [group, loadingGroup, loadingEvent, refetchGroupCall]);

  const refetchData = useCallback(() => {
    // Set initial state
    setError(false);
    setErrorType(null);

    refetchEvent();
    refetchGroup();
  }, [refetchGroup, refetchEvent]);

  // Refetch when group is stale
  useEffect(() => {
    if (group) {
      if ((group as Group & {stale?: boolean}).stale) {
        refetchGroup();
        return;
      }
    }
  }, [refetchGroup, group]);

  useRefetchGroupForReprocessing({refetchGroup});

  useEffect(() => {
    return () => {
      GroupStore.reset();
    };
  }, []);

  return {
    loadingGroup,
    loadingEvent,
    group,
    event,
    errorType,
    error,
    eventError: isError,
    refetchData,
    refetchGroup,
  };
}

function useLoadedEventType() {
  const params = useParams<{eventId?: string}>();
  const defaultIssueEvent = useDefaultIssueEvent();

  switch (params.eventId) {
    case undefined:
      return defaultIssueEvent;
    case 'latest':
    case 'oldest':
      return params.eventId;
    default:
      return 'event_id';
  }
}

function useTrackView({
  group,
  event,
  project,
  tab,
}: {
  event: Event | null;
  group: Group | null;
  tab: Tab;
  project?: Project;
}) {
  const location = useLocation();
  const {alert_date, alert_rule_id, alert_type, ref_fallback, stream_index, query} =
    location.query;
  const groupEventType = useLoadedEventType();

  useRouteAnalyticsEventNames('issue_details.viewed', 'Issue Details: Viewed');
  useRouteAnalyticsParams({
    ...getAnalyticsDataForGroup(group),
    ...getAnalyticsDataForEvent(event),
    ...getAnalyicsDataForProject(project),
    tab,
    stream_index: typeof stream_index === 'string' ? Number(stream_index) : undefined,
    query: typeof query === 'string' ? query : undefined,
    // Alert properties track if the user came from email/slack alerts
    alert_date:
      typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
    alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
    alert_type: typeof alert_type === 'string' ? alert_type : undefined,
    ref_fallback,
    group_event_type: groupEventType,
  });
  // Set default values for properties that may be updated in subcomponents.
  // Must be separate from the above values, otherwise the actual values filled in
  // by subcomponents may be overwritten when the above values change.
  useRouteAnalyticsParams({
    // Will be updated by StacktraceLink if there is a stacktrace link
    stacktrace_link_viewed: false,
    // Will be updated by IssueQuickTrace if there is a trace
    trace_status: 'none',
    // Will be updated in GroupDetailsHeader if there are replays
    group_has_replay: false,
    // Will be updated in ReplayPreview if there is a replay
    event_replay_status: 'none',
    // Will be updated in SuspectCommits if there are suspect commits
    num_suspect_commits: 0,
    suspect_commit_calculation: 'no suspect commit',
  });
  useDisableRouteAnalytics(!group || !event || !project);
}

const trackTabChanged = ({
  organization,
  project,
  group,
  event,
  tab,
}: {
  event: Event | null;
  group: Group;
  organization: Organization;
  project: Project;
  tab: Tab;
}) => {
  if (!project || !group) {
    return;
  }

  trackAnalytics('issue_details.tab_changed', {
    organization,
    project_id: parseInt(project.id, 10),
    tab,
    ...getAnalyticsDataForGroup(group),
  });

  if (group.issueCategory !== IssueCategory.ERROR) {
    return;
  }

  const analyticsData = event
    ? event.tags
        .filter(({key}) => ['device', 'os', 'browser'].includes(key))
        .reduce((acc, {key, value}) => {
          acc[key] = value;
          return acc;
        }, {})
    : {};

  trackAnalytics('issue_group_details.tab.clicked', {
    organization,
    tab,
    platform: project.platform,
    ...analyticsData,
  });
};

function GroupDetailsContentError({
  errorType,
  onRetry,
}: {
  errorType: Error;
  onRetry: () => void;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const projectId = location.query.project;

  const {projects} = useProjects();
  const project = projects.find(proj => proj.id === projectId);

  switch (errorType) {
    case ERROR_TYPES.GROUP_NOT_FOUND:
      return (
        <StyledLoadingError
          message={t('The issue you were looking for was not found.')}
        />
      );

    case ERROR_TYPES.MISSING_MEMBERSHIP:
      return <MissingProjectMembership organization={organization} project={project} />;
    default:
      return <StyledLoadingError onRetry={onRetry} />;
  }
}

function GroupDetailsContent({
  children,
  group,
  project,
  loadingEvent,
  eventError,
  event,
  refetchData,
}: GroupDetailsContentProps) {
  const organization = useOrganization();
  const router = useRouter();

  const {currentTab, baseUrl} = getCurrentRouteInfo({group, event, router, organization});
  const groupReprocessingStatus = getGroupReprocessingStatus(group);

  const environments = useEnvironmentsFromUrl();

  useTrackView({group, event, project, tab: currentTab});

  const childProps = {
    environments,
    group,
    project,
    event,
    loadingEvent,
    eventError,
    groupReprocessingStatus,
    onRetry: refetchData,
    baseUrl,
  };

  return (
    <Tabs
      value={currentTab}
      onChange={tab => trackTabChanged({tab, group, project, event, organization})}
    >
      <GroupHeader
        organization={organization}
        groupReprocessingStatus={groupReprocessingStatus}
        event={event ?? undefined}
        group={group}
        baseUrl={baseUrl}
        project={project as Project}
      />
      <GroupTabPanels>
        <TabPanels.Item key={currentTab}>
          {isValidElement(children) ? cloneElement(children, childProps) : children}
        </TabPanels.Item>
      </GroupTabPanels>
    </Tabs>
  );
}

function GroupDetailsPageContent(props: GroupDetailsProps & FetchGroupDetailsState) {
  const projectSlug = props.group?.project?.slug;
  const api = useApi();
  const organization = useOrganization();
  const [injectedEvent, setInjectedEvent] = useState(null);
  const {
    projects,
    initiallyLoaded: projectsLoaded,
    fetchError: errorFetchingProjects,
  } = useProjects({slugs: projectSlug ? [projectSlug] : []});

  const project = projects.find(({slug}) => slug === projectSlug);
  const projectWithFallback = project ?? projects[0];

  const isRegressionIssue =
    props.group?.issueType === IssueType.PERFORMANCE_DURATION_REGRESSION ||
    props.group?.issueType === IssueType.PERFORMANCE_ENDPOINT_REGRESSION;

  useEffect(() => {
    if (props.group && projectsLoaded && !project) {
      Sentry.withScope(scope => {
        const projectIds = projects.map(item => item.id);
        scope.setContext('missingProject', {
          projectId: props.group?.project.id,
          availableProjects: projectIds,
        });
        scope.setFingerprint(['group-details-project-not-found']);
        Sentry.captureException(new Error('Project not found'));
      });
    }
  }, [props.group, project, projects, projectsLoaded]);

  useEffect(() => {
    const fetchLatestEvent = async () => {
      const event = await api.requestPromise(
        `/organizations/${organization.slug}/issues/${props.group?.id}/events/latest/`
      );
      setInjectedEvent(event);
    };
    if (isRegressionIssue && !defined(props.event)) {
      fetchLatestEvent();
    }
  }, [
    api,
    organization.slug,
    props.event,
    props.group,
    props.group?.id,
    isRegressionIssue,
  ]);

  if (props.error) {
    return (
      <GroupDetailsContentError errorType={props.errorType} onRetry={props.refetchData} />
    );
  }

  if (errorFetchingProjects) {
    return <StyledLoadingError message={t('Error loading the specified project')} />;
  }

  if (projectSlug && !errorFetchingProjects && projectsLoaded && !projectWithFallback) {
    return (
      <StyledLoadingError message={t('The project %s does not exist', projectSlug)} />
    );
  }

  const regressionIssueLoaded = defined(injectedEvent ?? props.event);
  if (
    !projectsLoaded ||
    !projectWithFallback ||
    !props.group ||
    (isRegressionIssue && !regressionIssueLoaded)
  ) {
    return <LoadingIndicator />;
  }

  return (
    <GroupDetailsContent
      {...props}
      project={projectWithFallback}
      group={props.group}
      event={props.event ?? injectedEvent}
    />
  );
}

function GroupDetails(props: GroupDetailsProps) {
  const organization = useOrganization();
  const router = useRouter();

  const {group, ...fetchGroupDetailsProps} = useFetchGroupDetails();

  const environments = useEnvironmentsFromUrl();

  const {data} = useFetchIssueTagsForDetailsPage(
    {
      groupId: router.params.groupId,
      orgSlug: organization.slug,
      environment: environments,
    },
    // Don't want this query to take precedence over the main requests
    {enabled: defined(group)}
  );
  const isSampleError = data?.some(tag => tag.key === 'sample_event') ?? false;

  const getGroupDetailsTitle = () => {
    const defaultTitle = 'Sentry';

    if (!group) {
      return defaultTitle;
    }

    const {title} = getTitle(group, organization?.features);
    const message = getMessage(group);

    const eventDetails = `${organization.slug} — ${group.project.slug}`;

    if (title && message) {
      return `${title}: ${message} — ${eventDetails}`;
    }

    return `${title || message || defaultTitle} — ${eventDetails}`;
  };

  return (
    <Fragment>
      {isSampleError && group && (
        <SampleEventAlert project={group.project} organization={organization} />
      )}
      <SentryDocumentTitle noSuffix title={getGroupDetailsTitle()}>
        <PageFiltersContainer
          skipLoadLastUsed
          forceProject={group?.project}
          shouldForceProject
        >
          <GroupDetailsPageContent
            {...props}
            {...{
              group,
              ...fetchGroupDetailsProps,
            }}
          />
        </PageFiltersContainer>
      </SentryDocumentTitle>
    </Fragment>
  );
}

export default Sentry.withProfiler(GroupDetails);

const StyledLoadingError = styled(LoadingError)`
  margin: ${space(2)};
`;

const GroupTabPanels = styled(TabPanels)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
`;
