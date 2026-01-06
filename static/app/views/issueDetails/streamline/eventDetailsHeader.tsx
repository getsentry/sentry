import {useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Grid} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {TourElement} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
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
import {EventSearch} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/hooks/useEventQuery';
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
  const theme = useTheme();
  const environments = useEnvironmentsFromUrl();
  const searchQuery = useEventQuery();
  const issueTypeConfig = getConfigForIssueType(group, project);
  const {dispatch} = useIssueDetails();
  const groupReprocessingStatus = getGroupReprocessingStatus(group);

  const hasSetStatsPeriod =
    location.query.statsPeriod || location.query.start || location.query.end;
  const defaultStatsPeriod = useGroupDefaultStatsPeriod(group, project);
  const shouldShowSinceFirstSeenOption = issueTypeConfig.defaultTimePeriod.sinceFirstSeen;
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

  const searchBarEnabled = issueTypeConfig.header.filterBar.searchBar?.enabled !== false;

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
            <Flex direction={{xs: 'column', md: 'row'}} gap="sm">
              <Grid
                width="100%"
                gap="sm"
                columns={{xs: '1fr', md: 'auto minmax(100px, 1fr) auto'}}
                rows={`minmax(${theme.form.md.height}, auto)`}
              >
                <PageFilterBar>
                  <EnvironmentSelector group={group} event={event} project={project} />
                  <TimeRangeSelector
                    menuTitle={t('Filter Time Range')}
                    start={period?.start}
                    end={period?.end}
                    utc={location.query.utc === 'true'}
                    relative={period?.statsPeriod}
                    relativeOptions={props => {
                      return {
                        ...props.arbitraryOptions,
                        // Always display arbitrary issue open period
                        ...(defaultStatsPeriod?.statsPeriod &&
                        shouldShowSinceFirstSeenOption
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
                    triggerProps={{
                      children:
                        period === defaultStatsPeriod &&
                        !defaultStatsPeriod.isMaxRetention &&
                        shouldShowSinceFirstSeenOption
                          ? t('Since First Seen')
                          : undefined,
                      style: {
                        padding: `${theme.space.md} ${theme.space.lg}`,
                      },
                    }}
                  />
                </PageFilterBar>
                {searchBarEnabled && (
                  <EventSearch
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
                )}
              </Grid>
              <ToggleSidebar />
            </Flex>
          </TourElement>
        )}
        {issueTypeConfig.header.graph.enabled && (
          <GraphSection>
            {issueTypeConfig.header.graph.type === 'discover-events' && (
              <EventGraph
                event={event}
                group={group}
                showReleasesAs="bubble"
                style={{flex: 1}}
              />
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
  const issueTypeConfig = getConfigForIssueType(group, project);
  const isFixedEnvironment = issueTypeConfig.header.filterBar.fixedEnvironment;
  const eventEnvironment = event?.tags?.find(tag => tag.key === 'environment')?.value;
  const theme = useTheme();
  const style = {
    padding: `${theme.space.md} ${theme.space.lg}`,
  };

  return isFixedEnvironment ? (
    <EnvironmentPageFilter
      disabled
      triggerProps={{
        label: eventEnvironment ?? t('All Envs'),
        title: t('This issue only occurs in a single environment'),
        style,
      }}
    />
  ) : (
    <EnvironmentPageFilter triggerProps={{style}} />
  );
}

const DetailsContainer = styled('div')<{
  hasFilterBar: boolean;
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
  background: ${p => p.theme.backgroundSecondary};
  padding-left: ${p => p.theme.space['2xl']};
  padding-right: ${p => p.theme.space['2xl']};
  padding-top: ${p => p.theme.space.lg};

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const GraphSection = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    gap: ${p => p.theme.space.lg};
  }

  & > * {
    background: ${p => p.theme.tokens.background.primary};
    border-radius: ${p => p.theme.radius.md};
    border: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const OccurrenceSummarySection = styled(OccurrenceSummary)`
  white-space: unset;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.lg};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.translucentBorder};
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 0px solid ${p => p.theme.translucentBorder};
  border-width: 0 1px 1px 0;
  border-radius: 0;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space['2xl']};
`;
