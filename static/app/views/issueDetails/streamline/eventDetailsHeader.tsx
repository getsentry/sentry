import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

import {EventGraph} from './eventGraph';

export function EventDetailsHeader({
  group,
  event,
}: {
  event: Event | undefined;
  group: Group;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const searchQuery = useEventQuery({group});

  return (
    <PageErrorBoundary mini message={t('There was an error loading the event filters')}>
      <FilterContainer>
        <EnvironmentFilter
          triggerProps={{
            borderless: true,
            style: {
              borderRadius: 0,
            },
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
        <Graph event={event} group={group} />
      </FilterContainer>
    </PageErrorBoundary>
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

const SearchFilter = styled(EventSearch)`
  grid-area: searchFilter;
  border: 0;
  border-radius: 0;
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

const Graph = styled(EventGraph)`
  border-top: 1px solid ${p => p.theme.translucentBorder};
  grid-area: graph;
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 0px solid ${p => p.theme.translucentBorder};
  border-width: 0 1px 1px 0;
  border-radius: 0;
  padding: ${space(1.5)} 24px;
`;
