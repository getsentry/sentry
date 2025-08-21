import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {
  AutofixStepType,
  type AutofixTimelineEvent,
} from 'sentry/components/events/autofix/types';
import {getRootCauseDescription} from 'sentry/components/events/autofix/utils';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import StreamGroup, {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
} from 'sentry/components/stream/group';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {ThemeCardData} from 'sentry/views/issueList/pages/missionControl/types';

const COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'assignee',
  'firstSeen',
  'lastSeen',
];

interface ThemeDrawerProps {
  data: ThemeCardData;
  project: Project;
  isCoreProblem?: boolean;
}

function useMemberList() {
  const api = useApi();
  const organization = useOrganization();
  const [memberList, setMemberList] = useState<IndexedMembersByProject | undefined>(
    undefined
  );

  const isMountedRef = useIsMountedRef();
  useEffect(() => {
    fetchOrgMembers(api, organization.slug).then(members => {
      if (isMountedRef.current) {
        setMemberList(indexMembersByProject(members));
      }
    });
  }, [api, organization, isMountedRef]);

  return memberList;
}

function useSyncGroupStore(data: Group[] | undefined) {
  useEffect(() => {
    GroupStore.loadInitialData([]);
    return () => {
      GroupStore.reset();
    };
  }, []);

  useEffect(() => {
    if (data) {
      GroupStore.add(data);
    }
  }, [data]);
}

export function ThemeDrawer({data, project, isCoreProblem}: ThemeDrawerProps) {
  const {ultragroup} = data;
  const {title, description, issueIds} = ultragroup;
  const organization = useOrganization();
  const memberList = useMemberList();
  const api = useApi();
  const navigate = useNavigate();

  // Create query to fetch specific issues by IDs using the group parameter
  const queryParams = useMemo(
    () => ({
      group: issueIds,
      limit: issueIds.length.toString(),
      sort: 'freq',
    }),
    [issueIds]
  );

  const {
    data: groups,
    isPending,
    error,
    refetch,
  } = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: queryParams,
      },
    ],
    {
      staleTime: 0,
      enabled: issueIds.length > 0,
    }
  );

  // Sync group store with the data as StreamGroup retrieves data from the store
  useSyncGroupStore(groups);

  // Function to extract important timeline events from autofix data
  const getImportantTimelineEvents = useCallback((autofixData: any) => {
    if (!autofixData?.steps) {
      return [];
    }

    const rootCauseStep = autofixData.steps.find(
      (step: any) => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
    );

    if (!rootCauseStep?.causes) {
      return [];
    }

    const importantEvents: Array<{
      codeFile: string;
      title: string;
    }> = [];

    rootCauseStep.causes.forEach((cause: any) => {
      if (cause.root_cause_reproduction) {
        cause.root_cause_reproduction.forEach((event: AutofixTimelineEvent) => {
          if (event.is_most_important_event) {
            importantEvents.push({
              codeFile: event.relevant_code_file?.file_path || 'Unknown file',
              title: event.title,
            });
          }
        });
      }
    });

    return importantEvents;
  }, []);

  // Function to fetch autofix data for all issues in the theme
  const fetchAllAutofixData = useCallback(async () => {
    if (!groups || groups.length === 0) {
      // eslint-disable-next-line no-console
      console.log('No groups available to fetch autofix data');
      return;
    }

    try {
      // Fetch autofix data for each issue
      const autofixPromises = groups.map(async group => {
        try {
          const response = await api.requestPromise(
            `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
            {
              method: 'GET',
              query: {isUserWatching: false},
            }
          );
          return {
            group,
            autofixData: response.autofix,
          };
        } catch (autofixError) {
          // eslint-disable-next-line no-console
          console.log(
            `Failed to fetch autofix data for issue ${group.id}:`,
            autofixError
          );
          return {
            group,
            autofixData: null,
          };
        }
      });

      const autofixResults = await Promise.all(autofixPromises);

      // Generate consolidated string
      let consolidatedString = `This issue appears in several different forms, listed below. Please find a solution that addresses the root cause for all of them together.\n\n`;

      autofixResults.forEach(({group, autofixData}) => {
        consolidatedString += `**Issue: ${group.type}, ${group.title}** in ${group.project.slug}, ${group.culprit}\n`;

        if (autofixData) {
          const rootCauseDescription = getRootCauseDescription(autofixData);
          if (rootCauseDescription) {
            consolidatedString += `Root Cause: ${rootCauseDescription}\n`;
          } else {
            consolidatedString += `Root Cause: No root cause analysis available\n`;
          }

          // Add important timeline events
          const importantEvents = getImportantTimelineEvents(autofixData);
          if (importantEvents.length > 0) {
            consolidatedString += `Important Events:\n`;
            importantEvents.forEach((event, index) => {
              consolidatedString += `  ${index + 1}. ${event.title}\n`;
              consolidatedString += `     File: ${event.codeFile}\n`;
            });
          }
        } else {
          consolidatedString += `Root Cause: No autofix data available\n`;
        }

        consolidatedString += `\n`;
      });

      // Find the first issue with available root cause data to use as the target
      let selectedResult = null;
      for (const result of autofixResults) {
        if (result.autofixData && getRootCauseDescription(result.autofixData)) {
          selectedResult = result;
          break;
        }
      }

      if (!selectedResult) {
        // eslint-disable-next-line no-console
        console.error('No issue found with available root cause data');
        return;
      }

      const {group: selectedIssue, autofixData} = selectedResult;

      if (selectedIssue && autofixData) {
        try {
          // Find the root cause step to get the run_id and cause_id
          const rootCauseStep = autofixData.steps?.find(
            (step: any) => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
          );

          if (
            rootCauseStep?.causes?.[0]?.id !== null &&
            rootCauseStep?.causes?.[0]?.id !== undefined &&
            autofixData.run_id
          ) {
            // Use the "Give Solution" API to start the solution step with our consolidated prompt
            await api.requestPromise(
              `/organizations/${organization.slug}/issues/${selectedIssue.id}/autofix/update/`,
              {
                method: 'POST',
                data: {
                  run_id: autofixData.run_id,
                  payload: {
                    type: 'select_root_cause',
                    cause_id: rootCauseStep.causes[0].id,
                    instruction: consolidatedString,
                  },
                },
              }
            );

            // Navigate to the selected issue with seer drawer open
            navigate(`/issues/${selectedIssue.id}/?seerDrawer=true`);
          } else {
            // eslint-disable-next-line no-console
            console.error('Missing root cause ID or run ID for autofix');
          }
        } catch (apiError) {
          // eslint-disable-next-line no-console
          console.error('Error triggering autofix solution:', apiError);
        }
      }
    } catch (fetchError) {
      // eslint-disable-next-line no-console
      console.error('Error fetching autofix data:', fetchError);
    }
  }, [groups, api, organization.slug, getImportantTimelineEvents, navigate]);

  // Handle fix button click
  const handleFixItForMe = useCallback(() => {
    if (isCoreProblem) {
      addLoadingMessage(t('Consolidating root causes...'));
      fetchAllAutofixData();
    }
  }, [isCoreProblem, fetchAllAutofixData]);

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{project.slug}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: isCoreProblem ? t('Core Problem') : t('Theme')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{title}</Header>
      </EventNavigator>
      <EventDrawerBody>
        <ContentContainer>
          <DescriptionSection>
            <Description>{description}</Description>
            {isCoreProblem && (
              <FixButtonContainer>
                <Button priority="primary" size="md" onClick={handleFixItForMe}>
                  {t('Fix it for me')}
                </Button>
              </FixButtonContainer>
            )}
          </DescriptionSection>

          <IssuesSection>
            {error ? (
              <LoadingError onRetry={refetch} />
            ) : !isPending && (!groups || groups.length === 0) ? (
              <IssuesPanel>
                <PanelBody>
                  <EmptyStateWarning small>
                    <p>{t('No issues found in this theme.')}</p>
                  </EmptyStateWarning>
                </PanelBody>
              </IssuesPanel>
            ) : (
              <IssuesPanel>
                <HeaderContainer>
                  <GroupListHeader withChart withColumns={COLUMNS} />
                </HeaderContainer>
                <PanelBody>
                  {isPending
                    ? [...new Array(Math.min(issueIds.length, 4))].map((_, i) => (
                        <GroupPlaceholder key={i}>
                          <Placeholder height="50px" />
                        </GroupPlaceholder>
                      ))
                    : groups?.map(({id, project: groupProject}) => {
                        return (
                          <StreamGroup
                            key={id}
                            id={id}
                            canSelect={false}
                            withChart
                            withColumns={COLUMNS}
                            memberList={memberList?.[groupProject.slug]}
                            useFilteredStats={false}
                            statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
                            source="mission-control"
                          />
                        );
                      })}
                </PanelBody>
              </IssuesPanel>
            )}
          </IssuesSection>
        </ContentContainer>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const ContentContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(3)};
`;

const DescriptionSection = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: ${space(3)};
  margin-bottom: ${space(2)};
`;

const IssuesSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  flex: 1;
  min-height: 0;
`;

const Description = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.lg};
  flex: 1;
`;

const IssuesPanel = styled(Panel)`
  min-width: 0;
  overflow-y: auto;
  margin-bottom: 0 !important;
  flex: 1;
  container-type: inline-size;
`;

const GroupPlaceholder = styled('div')`
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

const HeaderContainer = styled('div')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
  background: ${p => p.theme.background};
`;

const FixButtonContainer = styled('div')`
  display: flex;
  flex-shrink: 0;
  border-left: 1px solid ${p => p.theme.border};
  padding-left: ${space(2)};
`;
