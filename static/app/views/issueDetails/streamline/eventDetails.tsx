import {useLayoutEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CommitRow} from 'sentry/components/commitRow';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {space} from 'sentry/styles/space';
import type {PageFilters, TimeseriesValue} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
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
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface FetchGroupStatsResponse {
  end: string;
  start: string;
  stats: TimeseriesValue[];
}
interface FetchGroupStatsQueryParameters {
  groupId: string;
  organizationSlug: string;
  datetime?: Partial<PageFilters['datetime']>;
  query?: {
    end?: string;
    environments?: string[];
    start?: string;
    statsPeriod?: string;
  };
}

function makeFetchGroupStatsQueryKey({
  groupId,
  organizationSlug,
  datetime,
  query: initialQuery,
}: FetchGroupStatsQueryParameters): ApiQueryKey {
  const query = {...initialQuery};
  if (datetime?.start) {
    query.start = getUtcDateString(datetime.start);
  }
  if (datetime?.end) {
    query.end = getUtcDateString(datetime.end);
  }
  if (datetime?.period) {
    query.statsPeriod = datetime.period;
  }
  return [
    `/organizations/${organizationSlug}/issues/${groupId}/detailed-stats/`,
    {query},
  ];
}

function useFetchGroupStats({
  groupId,
  options,
}: {
  groupId: string;
  options?: UseApiQueryOptions<FetchGroupStatsResponse>;
}) {
  const organization = useOrganization();
  const {selection: pageFilters} = usePageFilters();
  const environments = useEnvironmentsFromUrl();

  const queryKey = makeFetchGroupStatsQueryKey({
    groupId,
    organizationSlug: organization.slug,
    query: {environments},
    datetime: pageFilters.datetime,
  });

  return useApiQuery<FetchGroupStatsResponse>(queryKey, {
    staleTime: 30000,
    cacheTime: 30000,
    retry: false,
    ...options,
  });
}

export function EventDetails({
  group,
  event,
  project,
}: Required<EventDetailsContentProps>) {
  const organization = useOrganization();
  const [nav, setNav] = useState<HTMLDivElement | null>(null);
  const {selection} = usePageFilters();
  const {environments} = selection;
  const searchQuery = useEventQuery({environments, organization, group});
  const {eventDetails, dispatch} = useEventDetailsReducer();
  const theme = useTheme();
  const isScreenMedium = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const {data: groupStats} = useFetchGroupStats({groupId: group.id});

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
          handleSearch={() => {}}
          environments={environments}
          query={searchQuery}
          queryBuilderProps={{
            disallowFreeText: true,
          }}
        />
        <DatePageFilter />
      </FilterContainer>
      <GraphPadding>
        <EventGraph group={group} groupStats={groupStats} />
      </GraphPadding>
      <GroupContent navHeight={nav?.offsetHeight}>
        <FloatingEventNavigation
          event={event}
          group={group}
          ref={setNav}
          query={searchQuery}
        />
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
  padding: ${space(1.5)} ${space(1)};
`;

const GroupContent = styled('div')<{navHeight?: number}>`
  border: 1px solid ${p => p.theme.translucentBorder};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
`;

const GroupContentPadding = styled('div')`
  padding: ${space(1)} ${space(1.5)};
`;

const FilterContainer = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: ${space(1)};
`;
