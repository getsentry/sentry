import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {ToggleSidebar} from 'sentry/views/issueDetails/streamline/sidebar/toggleSidebar';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export function EventDetailsHeader({
  group,
  event,
  project,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const searchQuery = useEventQuery({group});
  const {baseUrl} = useGroupDetailsRoute();

  const issueTypeConfig = getConfigForIssueType(group, project);

  if (!issueTypeConfig.filterAndSearchHeader.enabled) {
    return null;
  }

  return (
    <PageErrorBoundary mini message={t('There was an error loading the event filters')}>
      <FilterContainer role="group" aria-description={t('Event filtering controls')}>
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
        <Flex style={{gridArea: 'search'}}>
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
          <ToggleSidebar />
        </Flex>
        <GraphSection>
          <EventGraph event={event} group={group} style={{flex: 1}} />
          <SectionDivider />
          <IssueTagsButton
            aria-label={t('View issue tag distributions')}
            to={{
              pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
              query: location.query,
              replace: true,
            }}
            analyticsEventKey="issue_details.issue_tags_clicked"
            analyticsEventName="Issue Details: Issue Tags Clicked"
          >
            {t('Issue Tags')}
          </IssueTagsButton>
        </GraphSection>
      </FilterContainer>
    </PageErrorBoundary>
  );
}

const FilterContainer = styled('div')`
  padding-left: 24px;
  display: grid;
  grid-template-columns: auto auto minmax(100px, 1fr);
  grid-template-rows: minmax(38px, auto) auto;
  grid-template-areas:
    'env    date  search  toggle'
    'graph  graph graph   graph';
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
  border-color: transparent;
  border-radius: 0;
  box-shadow: none;
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

const GraphSection = styled('div')`
  grid-area: graph;
  display: flex;
  border-top: 1px solid ${p => p.theme.translucentBorder};
`;

const IssueTagsButton = styled(LinkButton)`
  display: block;
  flex: 0;
  height: unset;
  margin: ${space(1)} ${space(2)} ${space(1)} ${space(1)};
  padding: ${space(1)} ${space(1.5)};
  text-align: center;
  span {
    white-space: unset;
  }
`;

const SectionDivider = styled('div')`
  border-left: 1px solid ${p => p.theme.translucentBorder};
  display: flex;
  align-items: center;
  margin: ${space(1)};
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 0px solid ${p => p.theme.translucentBorder};
  border-width: 0 1px 1px 0;
  border-radius: 0;
  padding: ${space(1.5)} 24px;
`;
