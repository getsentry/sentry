import {useRef} from 'react';
import styled from '@emotion/styled';

import {CommitRow} from 'sentry/components/commitRow';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  EventDetailsContent,
  type EventDetailsContentProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {EventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import {EventSearch} from 'sentry/views/issueDetails/streamline/eventSearch';
import {Section} from 'sentry/views/issueDetails/streamline/foldSection';
import {EventDetailsContext} from 'sentry/views/issueDetails/streamline/context';
import {useEventDetailsState} from 'sentry/views/issueDetails/streamline/useEventDetailsState';

export function EventDetails({
  group,
  event,
  project,
}: Required<EventDetailsContentProps>) {
  const navRef = useRef<HTMLDivElement>(null);
  const {selection} = usePageFilters();
  const {environments} = selection;
  const {state, dispatch} = useEventDetailsState();

  return (
    <EventDetailsContext.Provider value={{...state, dispatch}}>
      <SuspectCommits
        project={project}
        eventId={event.id}
        group={group}
        commitRow={CommitRow}
      />
      <FilterContainer>
        <EnvironmentPageFilter />
        <SearchFilter
          group={group}
          handleSearch={searchQuery =>
            dispatch({type: 'UPDATE_SEARCH_QUERY', searchQuery})
          }
          environments={environments}
          query={state.searchQuery}
        />
        <DatePageFilter />
      </FilterContainer>
      <GroupContent navHeight={navRef?.current?.offsetHeight}>
        <FloatingEventNavigation event={event} group={group} ref={navRef} />
        <GroupContentPadding>
          <EventDetailsContent group={group} event={event} project={project} />
        </GroupContentPadding>
      </GroupContent>
    </EventDetailsContext.Provider>
  );
}

const FloatingEventNavigation = styled(EventNavigation)`
  position: sticky;
  top: 0;
  background: ${p => p.theme.background};
  z-index: 100;
  border-radius: 6px 6px 0 0;
`;

const SearchFilter = styled(EventSearch)`
  border-radius: ${p => p.theme.borderRadius};
`;

const GroupContent = styled('div')<{navHeight?: number}>`
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  & ${Section} {
    scroll-margin-top: ${p => p.navHeight ?? 0}px;
  }
`;

const GroupContentPadding = styled('div')`
  padding: ${space(1)} ${space(1.5)};
`;

const FilterContainer = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: ${space(1)};
`;
