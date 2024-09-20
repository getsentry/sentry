import {useLayoutEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {CommitRow} from 'sentry/components/commitRow';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {EventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {IssueContent} from 'sentry/views/issueDetails/streamline/issueContent';
import {useFetchEventStats} from 'sentry/views/issueDetails/streamline/useFetchEventStats';

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

  const searchQuery = useEventQuery({group});
  const {eventDetails, dispatch} = useEventDetailsReducer();
  const {
    data: groupStats,
    isPending: isLoadingStats,
    error: errorStats,
  } = useFetchEventStats({
    params: {
      group: group,
      referrer: 'issue_details.streamline_graph',
      query: searchQuery,
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

  const {detail: errorDetail} = errorStats?.responseJSON ?? {};

  const graphComponent = !isLoadingStats && groupStats && (
    <GraphPadding>
      <ErrorBoundary mini message={t('There was an error loading the event graph')}>
        <EventGraph group={group} groupStats={groupStats} searchQuery={searchQuery} />
      </ErrorBoundary>
    </GraphPadding>
  );

  return (
    <EventDetailsContext.Provider value={{...eventDetails, dispatch}}>
      <ErrorBoundary mini message={t('There was an error loading the suspect commits')}>
        <SuspectCommits
          project={project}
          eventId={event.id}
          group={group}
          commitRow={CommitRow}
        />
      </ErrorBoundary>
      <ErrorBoundary mini message={t('There was an error loading the event filters')}>
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
      </ErrorBoundary>
      {errorDetail ? (
        <div>
          <GraphAlert type="error" showIcon>
            {errorDetail as string}
          </GraphAlert>
        </div>
      ) : (
        graphComponent
      )}
      <GroupContent>
        <FloatingEventNavigation
          event={event}
          group={group}
          ref={setNav}
          query={searchQuery}
        />
        <ContentPadding>
          <EventDetailsContent group={group} event={event} project={project} />
        </ContentPadding>
      </GroupContent>
      <ExtraContent>
        <ContentPadding>
          <IssueContent group={group} project={project} />
        </ContentPadding>
      </ExtraContent>
    </EventDetailsContext.Provider>
  );
}

const FloatingEventNavigation = styled(EventNavigation)`
  position: sticky;
  top: 0;
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    top: ${p => p.theme.sidebar.mobileHeight};
  }
  background: ${p => p.theme.background};
  z-index: 100;
  border-radius: 6px 6px 0 0;
`;

const SearchFilter = styled(EventSearch)`
  border-radius: ${p => p.theme.borderRadius};
`;

const GraphPadding = styled('div')`
  border: 1px solid ${p => p.theme.translucentBorder};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;

const GraphAlert = styled(Alert)`
  margin: 0;
  border: 1px solid ${p => p.theme.translucentBorder};
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

const FilterContainer = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: ${space(1)};
`;
