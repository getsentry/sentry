import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {
  useIssueDetailsDiscoverQuery,
  useIssueDetailsEventView,
} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';

export function EventFilters({event, group}: {event: Event; group: Group}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const {environments} = selection;

  const searchQuery = useEventQuery({group});
  const eventView = useIssueDetailsEventView({group});

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
  return (
    <FilterContainer>
      <EnvironmentFilter
        triggerProps={{
          borderless: true,
          style: {
            borderRadius: 0,
          },
        }}
      />
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
      <DateFilter
        triggerProps={{
          borderless: true,
          style: {
            borderRadius: 0,
          },
        }}
      />
      {error ? (
        <div>
          <GraphAlert type="error" showIcon>
            {error.message}
          </GraphAlert>
        </div>
      ) : (
        !isLoadingStats &&
        groupStats && (
          <Graph
            event={event}
            group={group}
            groupStats={groupStats}
            searchQuery={searchQuery}
          />
        )
      )}
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  padding-left: 24px;
  display: grid;
  grid-template-columns: auto auto 1fr;
  grid-template-rows: 38px auto;
  grid-template-areas:
    'env    date  searchFilter'
    'graph  graph graph';
  border: 0px solid ${p => p.theme.translucentBorder};
  border-width: 0 1px 1px 0;
`;

const GraphAlert = styled(Alert)`
  margin: 0;
  border: 1px solid ${p => p.theme.translucentBorder};
`;

const EnvironmentFilter = styled(EnvironmentPageFilter)`
  grid-area: env;
  &:before {
    right: 0;
    top: ${space(1)};
    bottom: ${space(1)};
    width: 1px;
    content: '';
    position: absolute;
    background: ${p => p.theme.translucentInnerBorder};
  }
`;

const DateFilter = styled(DatePageFilter)`
  grid-area: date;
  &:before {
    right: 0;
    top: ${space(1)};
    bottom: ${space(1)};
    width: 1px;
    content: '';
    position: absolute;
    background: ${p => p.theme.translucentInnerBorder};
  }
`;

const SearchFilter = styled(EventSearch)`
  grid-area: searchFilter;
  border: 0;
  border-radius: 0;
`;

const Graph = styled(EventGraph)`
  border-top: 1px solid ${p => p.theme.translucentBorder};
  grid-area: graph;
`;
