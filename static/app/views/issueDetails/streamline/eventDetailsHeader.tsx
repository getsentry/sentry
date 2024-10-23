import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {GroupSummary} from 'sentry/components/group/groupSummary';
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
    <Fragment>
      <Feature features={['organizations:ai-summary']}>
        <GroupSummary groupId={group.id} groupCategory={group.issueCategory} />
      </Feature>
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
      <PageErrorBoundary mini message={t('There was an error loading the event graph')}>
        <ExtraContent>
          <EventGraph event={event} group={group} />
        </ExtraContent>
      </PageErrorBoundary>
    </Fragment>
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

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 1px solid ${p => p.theme.translucentBorder};
`;

const ExtraContent = styled('div')`
  border: 1px solid ${p => p.theme.translucentBorder};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;
