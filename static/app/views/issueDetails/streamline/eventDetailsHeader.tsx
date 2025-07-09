import {useEffect} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {TourElement} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getUtcDateString} from 'sentry/utils/dates';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {MetricIssueChart} from 'sentry/views/issueDetails/metricIssues/metricIssueChart';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';
import {IssueCronCheckTimeline} from 'sentry/views/issueDetails/streamline/issueCronCheckTimeline';
import IssueTagsPreview from 'sentry/views/issueDetails/streamline/issueTagsPreview';
import {IssueUptimeCheckTimeline} from 'sentry/views/issueDetails/streamline/issueUptimeCheckTimeline';
import {OccurrenceSummary} from 'sentry/views/issueDetails/streamline/occurrenceSummary';
import {getDetectorDetails} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';
import {ToggleSidebar} from 'sentry/views/issueDetails/streamline/sidebar/toggleSidebar';
import {useGroupDefaultStatsPeriod} from 'sentry/views/issueDetails/useGroupDefaultStatsPeriod';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
  useEnvironmentsFromUrl,
} from 'sentry/views/issueDetails/utils';

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
  const groupReprocessingStatus = getGroupReprocessingStatus(group);

  const hasSetStatsPeriod =
    location.query.statsPeriod || location.query.start || location.query.end;
  const defaultStatsPeriod = useGroupDefaultStatsPeriod(group, project);
  const period = hasSetStatsPeriod
    ? getPeriod({
        start: location.query.start as string,
        end: location.query.end as string,
        period: location.query.statsPeriod as string,
      })
    : defaultStatsPeriod;

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

  if (groupReprocessingStatus === ReprocessingStatus.REPROCESSING) {
    return null;
  }

  return (
    <PageErrorBoundary mini message={t('There was an error loading the event filters')}>
      <DetailsContainer
        role="group"
        aria-description={t('Event filtering controls')}
        hasFilterBar={issueTypeConfig.header.filterBar.enabled}
      >
        {issueTypeConfig.header.filterBar.enabled && (
          <TourElement<IssueDetailsTour>
            tourContext={IssueDetailsTourContext}
            id={IssueDetailsTour.FILTERS}
            title={t('Narrow your focus')}
            description={t(
              'Filtering data to a specific environment, timeframe, tag value, or user can speed up debugging.'
            )}
            position="bottom-start"
          >
            <FilterContainer>
              <EnvironmentSelector group={group} event={event} project={project} />
              <DateFilter
                menuTitle={t('Filter Time Range')}
                start={period?.start}
                end={period?.end}
                utc={location.query.utc === 'true'}
                relative={period?.statsPeriod}
                relativeOptions={props => {
                  return {
                    ...props.arbitraryOptions,
                    // Always display arbitrary issue open period
                    ...(defaultStatsPeriod?.statsPeriod
                      ? {
                          [defaultStatsPeriod.statsPeriod]: t(
                            '%s (since first seen)',
                            getRelativeSummary(defaultStatsPeriod.statsPeriod)
                          ),
                        }
                      : {}),
                    ...props.defaultOptions,
                  };
                }}
                onChange={({relative, start, end, utc}) => {
                  navigate({
                    ...location,
                    query: {
                      ...location.query,
                      // If selecting the issue open period, remove the stats period query param
                      statsPeriod:
                        relative === defaultStatsPeriod?.statsPeriod
                          ? undefined
                          : relative,
                      start: start ? getUtcDateString(start) : undefined,
                      end: end ? getUtcDateString(end) : undefined,
                      utc: utc ? 'true' : undefined,
                    },
                  });
                }}
                triggerLabel={
                  period === defaultStatsPeriod && !defaultStatsPeriod.isMaxRetention
                    ? t('Since First Seen')
                    : undefined
                }
                triggerProps={{
                  borderless: true,
                  style: {
                    borderRadius: 0,
                  },
                }}
              />
              <Flex gap={space(0.5)}>
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
            </FilterContainer>
          </TourElement>
        )}
        {issueTypeConfig.header.graph.enabled && (
          <GraphSection>
            {issueTypeConfig.header.graph.type === 'discover-events' && (
              <EventGraph event={event} group={group} style={{flex: 1}} />
            )}
            {issueTypeConfig.header.graph.type === 'detector-history' && (
              <MetricIssueChart group={group} project={project} />
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
      </DetailsContainer>
    </PageErrorBoundary>
  );
}

function EnvironmentSelector({group, event, project}: EventDetailsHeaderProps) {
  const theme = useTheme();
  const issueTypeConfig = getConfigForIssueType(group, project);
  const isFixedEnvironment = issueTypeConfig.header.filterBar.fixedEnvironment;
  const eventEnvironment = event?.tags?.find(tag => tag.key === 'environment')?.value;

  const environmentCss = css`
    display: block;
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
      disabled redesign
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

const DetailsContainer = styled('div')<{
  hasFilterBar: boolean;
}>`
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  border: 0px solid ${p => p.theme.translucentBorder};
  border-width: 0 1px 1px 0;
`;

const FilterContainer = styled('div')`
  display: grid;
  grid-template-columns: auto auto minmax(100px, 1fr) auto;
  grid-template-rows: minmax(38px, auto);
  width: 100%;
`;

const SearchFilter = styled(EventSearch)`
  display: block;
  border-color: transparent;
  border-radius: 0;
  box-shadow: none;
`;

const DateFilter = styled(TimeRangeSelector)`
  display: block;
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
  display: flex;
  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.translucentBorder};
  }
`;

const OccurrenceSummarySection = styled(OccurrenceSummary)`
  white-space: unset;
  padding: ${space(1)};
  padding-left: 0;
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
