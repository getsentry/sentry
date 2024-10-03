import {useLayoutEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {CommitRow} from 'sentry/components/commitRow';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {useIsStuck} from 'sentry/utils/useIsStuck';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  EventDetailsContent,
  type EventDetailsContentProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {
  EventDetailsContext,
  useEventDetailsReducer,
} from 'sentry/views/issueDetails/streamline/context';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {EventList} from 'sentry/views/issueDetails/streamline/eventList';
import {EventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {IssueContent} from 'sentry/views/issueDetails/streamline/issueContent';
import {
  useIssueDetailsDiscoverQuery,
  useIssueDetailsEventView,
} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';
import {Tab} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function EventDetails({
  group,
  event,
  project,
}: Required<EventDetailsContentProps>) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const isScreenMedium = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const {environments} = selection;
  const [nav, setNav] = useState<HTMLDivElement | null>(null);
  const isStuck = useIsStuck(nav);
  const {eventDetails, dispatch} = useEventDetailsReducer();

  const searchQuery = useEventQuery({group});
  const eventView = useIssueDetailsEventView({group});
  const {currentTab} = useGroupDetailsRoute();

  const {
    data: groupStats,
    isPending: isLoadingStats,
    error,
  } = useIssueDetailsDiscoverQuery<MultiSeriesEventsStats>({
    params: {
      route: 'events-stats',
      eventView,
      referrer: 'issue_details.streamline_graph',
    },
  });

  useLayoutEffect(() => {
    const navHeight = nav?.offsetHeight ?? 0;
    const sidebarHeight = isScreenMedium ? theme.sidebar.mobileHeightNumber : 0;
    dispatch({
      type: 'UPDATE_DETAILS',
      state: {navScrollMargin: navHeight + sidebarHeight},
    });
  }, [nav, isScreenMedium, dispatch, theme.sidebar.mobileHeightNumber]);

  return (
    <EventDetailsContext.Provider value={{...eventDetails, dispatch}}>
      <Feature features={['organizations:ai-summary']}>
        <GroupSummary groupId={group.id} groupCategory={group.issueCategory} />
      </Feature>
      <PageErrorBoundary
        mini
        message={t('There was an error loading the suspect commits')}
      >
        <SuspectCommits
          project={project}
          eventId={event.id}
          group={group}
          commitRow={CommitRow}
        />
      </PageErrorBoundary>
      <PageErrorBoundary mini message={t('There was an error loading the event filter')}>
        <FilterContainer>
          <EnvironmentPageFilter />
          <SearchFilter
            group={group}
            handleSearch={query => {
              navigate({...location, query: {...location.query, query}}, {replace: true});
            }}
            environments={environments}
            query={searchQuery}
            queryBuilderProps={{
              disallowFreeText: true,
            }}
          />
          <DatePageFilter />
        </FilterContainer>
      </PageErrorBoundary>
      {error ? (
        <div>
          <GraphAlert type="error" showIcon>
            {error.message}
          </GraphAlert>
        </div>
      ) : (
        <PageErrorBoundary mini message={t('There was an error loading the event graph')}>
          {!isLoadingStats && groupStats && (
            <ExtraContent>
              <EventGraph
                group={group}
                groupStats={groupStats}
                searchQuery={searchQuery}
              />
            </ExtraContent>
          )}
        </PageErrorBoundary>
      )}
      {/* TODO(issues): We should use the router for this */}
      {currentTab === Tab.EVENTS && (
        <PageErrorBoundary mini message={t('There was an error loading the event list')}>
          <GroupContent>
            <EventList group={group} project={project} />
          </GroupContent>
        </PageErrorBoundary>
      )}
      {currentTab !== Tab.EVENTS && (
        <PageErrorBoundary
          mini
          message={t('There was an error loading the event content')}
        >
          <GroupContent>
            <FloatingEventNavigation
              event={event}
              group={group}
              ref={setNav}
              query={searchQuery}
              data-stuck={isStuck}
            />
            <ContentPadding>
              <EventDetailsContent group={group} event={event} project={project} />
            </ContentPadding>
          </GroupContent>
        </PageErrorBoundary>
      )}
      <PageErrorBoundary mini message={t('There was an error loading the issue content')}>
        <ExtraContent>
          <ContentPadding>
            <IssueContent group={group} project={project} />
          </ContentPadding>
        </ExtraContent>
      </PageErrorBoundary>
    </EventDetailsContext.Provider>
  );
}

const SearchFilter = styled(EventSearch)`
  border-radius: ${p => p.theme.borderRadius};
`;

const FilterContainer = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: ${space(1.5)};
`;

const FloatingEventNavigation = styled(EventNavigation)`
  position: sticky;
  top: 0;
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    top: ${p => p.theme.sidebar.mobileHeight};
  }
  background: ${p => p.theme.background};
  z-index: 500;
  border-radius: ${p => p.theme.borderRadiusTop};

  &[data-stuck='true'] {
    border-radius: 0;
  }
`;

const ExtraContent = styled('div')`
  border: 1px solid ${p => p.theme.translucentBorder};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;

const GroupContent = styled(ExtraContent)`
  position: relative;
`;

const ContentPadding = styled('div')`
  padding: ${space(1)} ${space(1.5)};
`;

const GraphAlert = styled(Alert)`
  margin: 0;
  border: 1px solid ${p => p.theme.translucentBorder};
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 1px solid ${p => p.theme.translucentBorder};
`;
