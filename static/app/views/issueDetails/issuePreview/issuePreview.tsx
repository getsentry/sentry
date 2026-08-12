import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tabs, TabList, TabPanels} from '@sentry/scraps/tabs';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {LinkedPullRequests} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useReplayCountForIssues} from 'sentry/utils/replayCount/useReplayCountForIssues';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {IssueDetailsContextProvider, SectionKey} from 'sentry/views/issueDetails/context';
import {Divider} from 'sentry/views/issueDetails/divider';
import {IssueDetailsEventNavigation} from 'sentry/views/issueDetails/eventNavigation/issueDetailsEventNavigation';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {
  GroupDataContextProvider,
  useGroupData,
} from 'sentry/views/issueDetails/groupDataContext';
import {EventDetailsContent} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {GroupEventDetailsLoading} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsLoading';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {GroupStatusSubtitle} from 'sentry/views/issueDetails/header/groupStatusSubtitle';
import {IssueIdBreadcrumb} from 'sentry/views/issueDetails/header/issueIdBreadcrumb';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {IssuePreviewAutofixSummary} from 'sentry/views/issueDetails/issuePreview/issuePreviewAutofixSummary';
import {IssuePreviewSeerActions} from 'sentry/views/issueDetails/issuePreview/issuePreviewSeerActions';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';
import {useMarkGroupSeen} from 'sentry/views/issueDetails/useMarkGroupSeen';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';
import {AskSeerSelectionMenu} from 'sentry/views/issueDetailsRedesign/askSeerSelectionMenu';
import {ReorderSectionsControl} from 'sentry/views/issueDetailsRedesign/reorderSectionsControl';
import {TelemetryLayoutStyles} from 'sentry/views/issueDetailsRedesign/telemetrySections';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

interface IssuePreviewProps {
  groupId: string;
}

function useMarkPreviewedGroupSeen(group: Group | undefined) {
  const {mutate: markGroupSeen} = useMarkGroupSeen();
  const groupId = group && !group.hasSeen ? group.id : undefined;

  useEffect(() => {
    if (groupId) {
      markGroupSeen(groupId);
    }
  }, [groupId, markGroupSeen]);
}

export function IssuePreview({groupId}: IssuePreviewProps) {
  const {data: group, isPending, isError} = useGroup({groupId});
  const {projects} = useProjects();
  const project = projects.find(p => p.id === group?.project.id) ?? group?.project;

  useMarkPreviewedGroupSeen(group);

  return (
    <Fragment>
      <Container padding="xs 2xl" borderBottom="muted">
        <Flex align="center" flex="1" gap="md">
          {group && project ? (
            <IssueIdBreadcrumb group={group} project={project} />
          ) : isPending ? (
            <Flex align="center" gap="md" height="36px">
              <Placeholder width="16px" height="16px" shape="rect" />
              <Placeholder width="80px" height="16px" shape="rect" />
            </Flex>
          ) : null}
        </Flex>
      </Container>
      <Container
        flexGrow={1}
        minHeight={0}
        overflowY="auto"
        overscrollBehavior="contain"
        padding="lg 2xl"
      >
        {isPending && <LoadingIndicator />}
        {isError && <LoadingError />}
        {group && project && (
          <GroupDataContextProvider group={group} project={project}>
            <ErrorBoundary mini>
              <IssuePreviewContent />
            </ErrorBoundary>
          </GroupDataContextProvider>
        )}
      </Container>
    </Fragment>
  );
}

type PreviewTab = 'investigation' | 'telemetry';

function IssuePreviewContent() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {group, project} = useGroupData();
  const {hasAutofix} = useAiConfig(group, project);
  const autofix = useExplorerAutofix(group, {
    enabled: hasAutofix,
  });
  const {title: primaryTitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(getGroupReprocessingStatus(group));

  const [previewEventId, setPreviewEventId] = useState<string | undefined>(undefined);
  const {data: event, isPending: isEventPending} = useGroupEvent({
    groupId: group.id,
    eventId: previewEventId,
  });
  const eventWithMeta = useMemo(() => withMeta(event), [event]);

  const [activeTab, setActiveTab] = useState<PreviewTab>('investigation');
  const previewRef = useRef<HTMLDivElement>(null);
  const {openSeerExplorer} = useSeerExplorerContext();

  const issueDetailsUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${group.id}/`
  );

  const redesignUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/redesign/${group.id}/`
  );

  return (
    <IssueDetailsContextProvider>
      <div ref={previewRef} style={{display: 'contents'}}>
        <AskSeerSelectionMenu
          containerRef={previewRef}
          onAskSeer={text => openSeerExplorer({initialQuery: text})}
        />
        <Container paddingBottom="sm">
          <Stack gap="xs">
            <Container>
              <Flex align="center" justify="between" gap="md">
                <TitleLink to={redesignUrl}>
                  <Tooltip
                    title={primaryTitle}
                    skipWrapper
                    isHoverable
                    showOnlyOnOverflow
                    delay={1000}
                  >
                    <Heading as="h3" size="lg" ellipsis>
                      {primaryTitle}
                    </Heading>
                  </Tooltip>
                </TitleLink>
                <PreviewStatCounts group={group} project={project} />
              </Flex>
              <EventMessage
                level={group.level}
                message={secondaryTitle}
                type={group.type}
              />
            </Container>
            <Flex justify="between" align="center" gap="md">
              <Flex flex="1" minWidth={0}>
                <GroupStatusSubtitle group={group} project={project} />
              </Flex>
              <Flex align="center" gap="xs" flexShrink={0} wrap="nowrap">
                <SeenLabel>{t('Last')}</SeenLabel>
                <TimeSince
                  date={group.lifetime?.lastSeen ?? group.lastSeen}
                  suffix=""
                  unitStyle="short"
                  tooltipPrefix={t('Last Seen')}
                />
                <Divider />
                <SeenLabel>{t('First')}</SeenLabel>
                <TimeSince
                  date={group.lifetime?.firstSeen ?? group.firstSeen}
                  suffix=""
                  unitStyle="short"
                  tooltipPrefix={t('First Seen')}
                />
              </Flex>
            </Flex>
          </Stack>
        </Container>
        <Flex
          paddingTop="sm"
          paddingBottom="lg"
          borderBottom="muted"
          justify="between"
          align="center"
          wrap="wrap"
          gap="md"
        >
          {hasAutofix ? (
            <IssuePreviewSeerActions
              autofix={autofix}
              group={group}
              disabled={disableActions}
              onContinueInSeer={() => {
                navigate({pathname: issueDetailsUrl, query: {seerDrawer: 'true'}});
              }}
            />
          ) : (
            <GroupActions
              group={group}
              project={project}
              disabled={disableActions}
              event={null}
            />
          )}
          <Flex align="center" wrap="wrap" gap="lg">
            <GroupPriority group={group} />
            <GroupHeaderAssigneeSelector
              group={group}
              project={project}
              event={null}
              showLabel={false}
            />
          </Flex>
        </Flex>
        <PreviewTabs>
          <Tabs<PreviewTab> value={activeTab} onChange={setActiveTab}>
            <TabList>
              <TabList.Item key="investigation">{t('Investigation')}</TabList.Item>
              <TabList.Item key="telemetry">{t('Telemetry')}</TabList.Item>
            </TabList>
            <TabPanels>
              <TabPanels.Item key="investigation">
                {hasAutofix && autofix.isLoading ? (
                  <LoadingIndicator />
                ) : (
                  <Dividers>
                    <LinkedPullRequests group={group} showEmptyState={false} />
                    {hasAutofix ? (
                      <IssuePreviewAutofixSummary runState={autofix.runState} />
                    ) : null}
                    <Container>
                      <ErrorBoundary mini>
                        <FoldSection
                          title={
                            <Heading as="h3" size="md">
                              {t('Activity')}
                            </Heading>
                          }
                          sectionKey={SectionKey.ACTIVITY}
                        >
                          <ActivitySection
                            group={group}
                            variant="standalone"
                            size="md"
                            placeholder={t(
                              'Add a comment. Tag users with @, or teams with #'
                            )}
                          />
                        </FoldSection>
                      </ErrorBoundary>
                    </Container>
                  </Dividers>
                )}
              </TabPanels.Item>
              <TabPanels.Item key="telemetry">
                <EventNavRow>
                  <NavGroup>
                    <ErrorBoundary mini>
                      <IssueDetailsEventNavigation
                        event={eventWithMeta}
                        group={group}
                        eventId={previewEventId}
                        onEventChange={setPreviewEventId}
                      />
                    </ErrorBoundary>
                    <ErrorBoundary mini>
                      <ReorderSectionsControl />
                    </ErrorBoundary>
                  </NavGroup>
                </EventNavRow>
                {isEventPending || !eventWithMeta ? (
                  <GroupEventDetailsLoading />
                ) : (
                  <TelemetrySections data-telemetry-container="">
                    <TelemetryLayoutStyles />
                    <EventDetailsContent
                      group={group}
                      event={eventWithMeta}
                      project={project}
                    />
                  </TelemetrySections>
                )}
              </TabPanels.Item>
            </TabPanels>
          </Tabs>
        </PreviewTabs>
      </div>
    </IssueDetailsContextProvider>
  );
}

const SeenLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

const PreviewTabs = styled('div')`
  padding-top: ${p => p.theme.space.md};

  [data-disclosure] > button > span > span[aria-hidden='true'] {
    display: none;
  }
`;

const EventNavRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${p => p.theme.space.md};
  margin: ${p => p.theme.space.md} 0;
`;

const NavGroup = styled('div')`
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  gap: ${p => p.theme.space.md};
`;

const TitleLink = styled(Link)`
  min-width: 0;
  color: ${p => p.theme.tokens.content.primary};
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const TelemetrySections = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Dividers = styled('div')`
  padding: ${p => p.theme.space.md} 0;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  & > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
    padding-top: ${p => p.theme.space.md};
  }
`;

function PreviewStatCounts({group, project}: {group: Group; project: Project}) {
  const issueTypeConfig = getConfigForIssueType(group, project);
  const {getReplayCountForIssue} = useReplayCountForIssues({statsPeriod: '90d'});
  const replayCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;

  if (!issueTypeConfig.eventAndUserCounts.enabled) {
    return null;
  }

  const eventCount = Number(group.count);
  const {userCount} = group;
  const showReplays = issueTypeConfig.pages.replays.enabled && replayCount > 0;

  return (
    <Flex align="center" gap="sm" flexShrink={0} wrap="nowrap">
      <StatGroup>
        <StatValue>
          <Count value={userCount} />
        </StatValue>
        <StatLabel>{tn('User', 'Users', userCount)}</StatLabel>
      </StatGroup>
      <Divider />
      <StatGroup>
        <StatValue>
          <Count value={eventCount} />
        </StatValue>
        <StatLabel>{tn('Event', 'Events', eventCount)}</StatLabel>
      </StatGroup>
      {showReplays && (
        <Fragment>
          <Divider />
          <StatGroup>
            <StatValue>
              {replayCount > 50 ? '50+' : <Count value={replayCount} />}
            </StatValue>
            <StatLabel>{tn('Replay', 'Replays', replayCount)}</StatLabel>
          </StatGroup>
        </Fragment>
      )}
    </Flex>
  );
}

const StatGroup = styled('span')`
  display: inline-flex;
  align-items: baseline;
  gap: ${p => p.theme.space.xs};
`;

const StatValue = styled('span')`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-numeric: tabular-nums;
`;

const StatLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;
