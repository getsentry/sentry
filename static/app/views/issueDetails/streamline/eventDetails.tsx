import {createContext, useContext, useRef, useState} from 'react';
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

export const enum SectionKey {
  TRACE = 'trace',

  USER_FEEDBACK = 'user-feedback',
  LLM_MONITORING = 'llm-monitoring',

  UPTIME = 'uptime', // Only Uptime issues
  CRON = 'cron-timeline', // Only Cron issues

  HIGHLIGHTS = 'highlights',
  RESOURCES = 'resources', // Position controlled by flag

  EXCEPTION = 'exception',
  STACKTRACE = 'stacktrace',
  SPANS = 'spans',
  EVIDENCE = 'evidence',
  MESSAGE = 'message',

  SPAN_EVIDENCE = 'span-evidence',
  HYDRATION_DIFF = 'hydration-diff',
  REPLAY = 'replay',

  HPKP = 'hpkp',
  CSP = 'csp',
  EXPECTCT = 'expectct',
  EXPECTSTAPLE = 'expectstaple',
  TEMPLATE = 'template',

  BREADCRUMBS = 'breadcrumbs',
  DEBUGMETA = 'debugmeta',
  REQUEST = 'request',

  TAGS = 'tags',
  SCREENSHOT = 'screenshot',

  CONTEXTS = 'contexts',
  EXTRA = 'extra',
  PACKAGES = 'packages',
  DEVICE = 'device',
  VIEW_HIERARCHY = 'view-hierarchy',
  ATTACHMENTS = 'attachments',
  SDK = 'sdk',
  GROUPING_INFO = 'grouping-info',
  PROCESSING_ERROR = 'processing-error',
  RRWEB = 'rrweb', // Legacy integration prior to replays
}

export interface SectionConfig {
  key: SectionKey;
  isBlank?: () => boolean;
}

export interface EventDetailsContextType {
  searchQuery: string;
  sectionData: {
    [key in SectionKey]?: SectionConfig & {isOpen: boolean};
  };
}

const EventDetailsContext = createContext<EventDetailsContextType>({
  searchQuery: '',
  sectionData: {},
});

export function useEventDetailsContext() {
  return useContext(EventDetailsContext);
}

export function EventDetails({
  group,
  event,
  project,
}: Required<EventDetailsContentProps>) {
  const navRef = useRef<HTMLDivElement>(null);
  const {selection} = usePageFilters();
  const {environments} = selection;
  const [eventDetails, setEventDetails] = useState<EventDetailsContextType>({
    searchQuery: '',
    sectionData: {},
  });

  return (
    <EventDetailsContext.Provider value={eventDetails}>
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
