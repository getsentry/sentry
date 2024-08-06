import {createContext, useContext, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {space} from 'sentry/styles/space';
import {
  DefaultGroupEventDetailsContent,
  type GroupEventDetailsContentProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {EventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import {EventSearch} from 'sentry/views/issueDetails/streamline/eventSearch';
import {Section} from 'sentry/views/issueDetails/streamline/foldSection';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface EventDetailsContextType {
  searchQuery: string;
}

const EventDetailsContext = createContext<EventDetailsContextType>({
  searchQuery: '',
});

export function useEventDetailsContext() {
  return useContext(EventDetailsContext);
}

export function EventDetails({
  group,
  event,
  project,
}: Required<GroupEventDetailsContentProps>) {
  const navRef = useRef<HTMLDivElement>(null);
  const [eventDetails, setEventDetails] = useState<EventDetailsContextType>({
    searchQuery: '',
  });
  const environments = useEnvironmentsFromUrl();

  return (
    <EventDetailsContext.Provider value={eventDetails}>
      <FilterContainer>
        <EventSearch
          environments={environments}
          group={group}
          handleSearch={searchQuery => setEventDetails({...eventDetails, searchQuery})}
          query={''}
        />
        <DatePageFilter style={{flex: 1}} />
      </FilterContainer>
      <GroupContent navHeight={navRef?.current?.offsetHeight}>
        <FloatingEventNavigation event={event} group={group} ref={navRef} />
        <GroupContentPadding>
          <DefaultGroupEventDetailsContent
            group={group}
            event={event}
            project={project}
          />
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
  grid-template-columns: 1fr auto;
  gap: ${space(1)};
`;
