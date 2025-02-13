import {Fragment, useEffect} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
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
import useOrganization from 'sentry/utils/useOrganization';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {IssueCronCheckTimeline} from 'sentry/views/issueDetails/streamline/issueCronCheckTimeline';
import IssueTagsPreview from 'sentry/views/issueDetails/streamline/issueTagsPreview';
import {IssueUptimeCheckTimeline} from 'sentry/views/issueDetails/streamline/issueUptimeCheckTimeline';
import {MetricIssueChart} from 'sentry/views/issueDetails/streamline/metricIssueChart';
import {OccurrenceSummary} from 'sentry/views/issueDetails/streamline/occurrenceSummary';
import {getDetectorDetails} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';
import {ToggleSidebar} from 'sentry/views/issueDetails/streamline/sidebar/toggleSidebar';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface EventDetailsHeaderProps {
  group: Group;
  project: Project;
  event?: Event;
}

export function EventDetailsHeader({group, event, project}: EventDetailsHeaderProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const searchQuery = useEventQuery({groupId: group.id});
  const issueTypeConfig = getConfigForIssueType(group, project);
  const {dispatch} = useIssueDetails();

  useEffect(() => {
    if (event) {
      // Since detector details are identical across the issue but only provided at the event level,
      // we need to persist the details in state to prevent breakage when an event is unloaded.
      const detectorDetails = getDetectorDetails({
        event,
        organization,
        project,
      });
      dispatch({
        type: 'UPDATE_DETECTOR_DETAILS',
        detectorDetails,
      });
    }
  }, [event, organization, project, dispatch]);

  const searchText = t(
    'Filter %s\u2026',
    issueTypeConfig.customCopy.eventUnits.toLocaleLowerCase()
  );

  const hasHeader =
    issueTypeConfig.header.filterBar.enabled ||
    issueTypeConfig.header.graph.enabled ||
    issueTypeConfig.header.occurrenceSummary.enabled;

  if (!hasHeader) {
    return null;
  }

  return (
    <PageErrorBoundary mini message={t('There was an error loading the event filters')}>
      <FilterContainer
        role="group"
        aria-description={t('Event filtering controls')}
        hasFilterBar={issueTypeConfig.header.filterBar.enabled}
      >
        {issueTypeConfig.header.filterBar.enabled && (
          <Fragment>
            <EnvironmentSelector group={group} event={event} project={project} />
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
                  navigate(
                    {...location, query: {...location.query, query}},
                    {replace: true}
                  );
                }}
                environments={environments}
                query={searchQuery}
                queryBuilderProps={{
                  disallowFreeText: true,
                  placeholder: searchText,
                  label: searchText,
                }}
              />
              <ToggleSidebar />
            </Flex>
          </Fragment>
        )}
        {issueTypeConfig.header.graph.enabled && (
          <GraphSection>
            {issueTypeConfig.header.graph.type === 'discover-events' && (
              <EventGraph event={event} group={group} style={{flex: 1}} />
            )}
            {issueTypeConfig.header.graph.type === 'detector-history' && (
              <MetricIssueChart group={group} project={project} event={event} />
            )}
            {issueTypeConfig.header.graph.type === 'uptime-checks' && (
              <IssueUptimeCheckTimeline group={group} />
            )}
            {issueTypeConfig.header.graph.type === 'cron-checks' && (
              <IssueCronCheckTimeline group={group} />
            )}
            {issueTypeConfig.header.tagDistribution.enabled && (
              <IssueTagsPreview
                groupId={group.id}
                environments={environments}
                project={project}
              />
            )}
          </GraphSection>
        )}
        {issueTypeConfig.header.occurrenceSummary.enabled && (
          <OccurrenceSummarySection group={group} event={event} />
        )}
      </FilterContainer>
    </PageErrorBoundary>
  );
}

function EnvironmentSelector({group, event, project}: EventDetailsHeaderProps) {
  const theme = useTheme();
  const issueTypeConfig = getConfigForIssueType(group, project);
  const isFixedEnvironment = issueTypeConfig.header.filterBar.fixedEnvironment;
  const eventEnvironment = event?.tags?.find(tag => tag.key === 'environment')?.value;

  const environmentCss = css`
    grid-area: env;
    &:before {
      right: 0;
      top: ${space(1)};
      bottom: ${space(1)};
      width: 1px;
      content: '';
      position: absolute;
      background: ${theme.translucentInnerBorder};
    }
  `;

  return isFixedEnvironment ? (
    <Button
      disabled
      borderless
      title={t('This issue only occurs in a single environment')}
      css={environmentCss}
    >
      {eventEnvironment ?? t('All Envs')}
    </Button>
  ) : (
    <EnvironmentPageFilter
      css={environmentCss}
      triggerProps={{
        borderless: true,
        style: {
          borderRadius: 0,
        },
      }}
    />
  );
}

const FilterContainer = styled('div')<{
  hasFilterBar: boolean;
}>`
  padding-left: 24px;
  display: grid;
  grid-template-columns: auto auto minmax(100px, 1fr) auto;
  grid-template-rows: ${p => (p.hasFilterBar ? 'minmax(38px, auto) auto auto' : 'auto')};
  grid-template-areas:
    'env      date      search    toggle'
    'graph    graph     graph     graph'
    'timeline timeline  timeline  timeline';
  border: 0px solid ${p => p.theme.translucentBorder};
  border-width: 0 1px 1px 0;
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
  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.translucentBorder};
  }
`;

const OccurrenceSummarySection = styled(OccurrenceSummary)`
  grid-area: timeline;
  padding: ${space(2)};
  padding-right: 0;
  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.translucentBorder};
  }
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 0px solid ${p => p.theme.translucentBorder};
  border-width: 0 1px 1px 0;
  border-radius: 0;
  padding: ${space(1.5)} 24px;
`;
