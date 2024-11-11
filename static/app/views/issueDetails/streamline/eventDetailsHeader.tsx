import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

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
  const {baseUrl} = useGroupDetailsRoute();
  const [sidebarOpen, setSidebarOpen] = useSyncedLocalStorageState(
    'issue-details-sidebar-open',
    true
  );
  const direction = sidebarOpen ? 'right' : 'left';

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
          <ToggleContainer sidebarOpen={sidebarOpen}>
            <ToggleButton
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? t('Close Sidebar') : t('Open Sidebar')}
              analyticsEventKey="issue_details.sidebar_toggle"
              analyticsEventName="Issue Details: Sidebar Toggle"
              analyticsParams={{
                sidebar_open: !sidebarOpen,
              }}
            >
              <LeftChevron direction={direction} />
              <RightChevron direction={direction} />
            </ToggleButton>
          </ToggleContainer>
        </Flex>
        <GraphSection>
          <EventGraph event={event} group={group} style={{flex: 1}} />
          <SectionDivider />
          <IssueTagsButton
            aria-label={t('View Issue Tags')}
            to={{
              pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
              query: location.query,
              replace: true,
            }}
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
  border: 0;
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

const ToggleContainer = styled('div')<{sidebarOpen: boolean}>`
  width: ${p => (p.sidebarOpen ? '30px' : '50px')};
  position: relative;
  padding: ${space(0.5)} 0;
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: none;
  }
`;

// The extra 1px on width is to display above the sidebar border
const ToggleButton = styled(Button)`
  border-radius: ${p => p.theme.borderRadiusLeft};
  border-right-color: ${p => p.theme.background} !important;
  box-shadow: none;
  position: absolute;
  padding: 0;
  left: ${space(0.5)};
  width: calc(100% - ${space(0.5)} + 1px);
  outline: 0;
  height: 30px;
  min-height: unset;
`;

const LeftChevron = styled(IconChevron)`
  position: absolute;
  color: ${p => p.theme.subText};
  height: 10px;
  width: 10px;
  left: ${space(0.75)};
`;

const RightChevron = styled(LeftChevron)`
  left: ${space(1.5)};
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
