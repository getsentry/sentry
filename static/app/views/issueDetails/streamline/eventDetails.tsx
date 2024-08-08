import {createContext, useContext, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  DefaultGroupEventDetailsContent,
  type GroupEventDetailsContentProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {EventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import {EventSearch} from 'sentry/views/issueDetails/streamline/eventSearch';
import {FoldSectionKey, Section} from 'sentry/views/issueDetails/streamline/foldSection';

export interface EventDetailsContextType {
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
  const {selection} = usePageFilters();
  const {environments} = selection;
  const [eventDetails, setEventDetails] = useState<EventDetailsContextType>({
    searchQuery: '',
  });

  return (
    <EventDetailsContext.Provider value={eventDetails}>
      <FilterContainer>
        <EnvironmentPageFilter />
        <SearchFilter
          group={group}
          handleSearch={searchQuery => {
            setEventDetails(details => ({...details, searchQuery}));
          }}
          environments={environments}
          query={eventDetails.searchQuery}
        />
        <DatePageFilter />
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

interface SectionDefinition {
  condition: (event: Event) => boolean;
  label: string;
  section: FoldSectionKey;
}

export const EVENT_SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    section: FoldSectionKey.HIGHLIGHTS,
    label: t('Event Highlights'),
    condition: () => true,
  },
  {
    section: FoldSectionKey.STACKTRACE,
    label: t('Stack Trace'),
    condition: (event: Event) => event.entries.some(entry => entry.type === 'stacktrace'),
  },
  {
    section: FoldSectionKey.EXCEPTION,
    label: t('Stack Trace'),
    condition: (event: Event) => event.entries.some(entry => entry.type === 'exception'),
  },
  {
    section: FoldSectionKey.BREADCRUMBS,
    label: t('Breadcrumbs'),
    condition: (event: Event) =>
      event.entries.some(entry => entry.type === 'breadcrumbs'),
  },
  {
    section: FoldSectionKey.TAGS,
    label: t('Tags'),
    condition: (event: Event) => event.tags.length > 0,
  },
  {
    section: FoldSectionKey.CONTEXTS,
    label: t('Context'),
    condition: (event: Event) => !!event.context,
  },
  {
    section: FoldSectionKey.USER_FEEDBACK,
    label: t('User Feedback'),
    condition: (event: Event) => !!event.userReport,
  },
  {
    section: FoldSectionKey.REPLAY,
    label: t('Replay'),
    condition: (event: Event) => !!getReplayIdFromEvent(event),
  },
];

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
