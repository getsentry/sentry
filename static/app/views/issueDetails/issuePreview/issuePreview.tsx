import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {
  LinkedPullRequests,
  useLinkedPullRequests,
} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {getMessage, getTitle} from 'sentry/utils/events';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {IssueDetailsContextProvider, SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {
  GroupDataContextProvider,
  useGroupData,
} from 'sentry/views/issueDetails/groupDataContext';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {EventUserCounts} from 'sentry/views/issueDetails/header/eventUserCounts';
import {GroupStatusSubtitle} from 'sentry/views/issueDetails/header/groupStatusSubtitle';
import {IssueIdBreadcrumb} from 'sentry/views/issueDetails/header/issueIdBreadcrumb';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {IssuePreviewActions} from 'sentry/views/issueDetails/issuePreview/issuePreviewActions';
import {IssuePreviewAutofixSummary} from 'sentry/views/issueDetails/issuePreview/issuePreviewAutofixSummary';
import {IssuePreviewSection} from 'sentry/views/issueDetails/issuePreview/issuePreviewSection';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useMarkGroupSeen} from 'sentry/views/issueDetails/useMarkGroupSeen';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';
import {IssueSeenTimes} from 'sentry/views/issueList/pages/issueSeenTimes';

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
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === group?.project.id) ?? group?.project;
  const issueDetailsUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/`
  );

  useMarkPreviewedGroupSeen(group);

  return (
    <Fragment>
      <Container padding="xs 2xl" borderBottom="muted">
        <Flex align="center" justify="between" flex="1" gap="md">
          {group && project ? (
            <IssueIdBreadcrumb group={group} project={project} />
          ) : isPending ? (
            <Flex align="center" gap="md" height="36px">
              <Placeholder width="16px" height="16px" shape="rect" />
              <Placeholder width="80px" height="16px" shape="rect" />
            </Flex>
          ) : null}
          {group && (
            <LinkButton
              to={issueDetailsUrl}
              size="xs"
              analyticsEventKey="issue_inbox.open_issue_clicked"
              analyticsEventName="Issue Inbox: Open Issue Clicked"
              analyticsParams={{
                group_id: group.id,
                progress: group.derivedData?.progress,
                source: 'button',
              }}
            >
              {t('Open Issue')}
            </LinkButton>
          )}
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

function IssuePreviewContent() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {group, project} = useGroupData();
  const {hasAutofix} = useAiConfig(group, project);
  const autofix = useExplorerAutofix(group, {
    enabled: hasAutofix,
  });
  const linkedPullRequests = useLinkedPullRequests({group});
  const {title: primaryTitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(getGroupReprocessingStatus(group));

  const issueDetailsUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${group.id}/`
  );

  return (
    <IssueDetailsContextProvider>
      <Container paddingBottom="sm">
        <Stack gap="xs">
          <Container>
            <Flex align="center" justify="between" gap="md">
              <Flex align="center" gap="md" minWidth={0}>
                <Tooltip
                  title={primaryTitle}
                  skipWrapper
                  isHoverable
                  showOnlyOnOverflow
                  delay={1000}
                >
                  <TitleLink
                    to={issueDetailsUrl}
                    analyticsEventKey="issue_inbox.open_issue_clicked"
                    analyticsEventName="Issue Inbox: Open Issue Clicked"
                    analyticsParams={{
                      group_id: group.id,
                      progress: group.derivedData?.progress,
                      source: 'title',
                    }}
                  >
                    <Container flex="1" minWidth={0}>
                      <Heading as="h3" size="lg" ellipsis>
                        {primaryTitle}
                      </Heading>
                    </Container>
                    <Flex align="center" flexShrink={0}>
                      <IconOpen size="xs" variant="muted" />
                    </Flex>
                  </TitleLink>
                </Tooltip>
              </Flex>
              <IssueSeenTimes group={group} />
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
              <EventUserCounts group={group} project={project} />
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
          <IssuePreviewActions
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
      {/* Top sections load asynchronously, so block everything to avoid pop-in. */}
      {(hasAutofix && autofix.isLoading) || linkedPullRequests.isPending ? (
        <LoadingIndicator />
      ) : (
        <Dividers>
          {linkedPullRequests.data?.pullRequests.length ? (
            <IssuePreviewSection aria-label={t('Pull Requests')} defaultExpanded>
              <IssuePreviewSection.Title>{t('Pull Requests')}</IssuePreviewSection.Title>
              <IssuePreviewSection.Content>
                <LinkedPullRequests group={group} showEmptyState={false} />
              </IssuePreviewSection.Content>
            </IssuePreviewSection>
          ) : null}
          {hasAutofix ? (
            <IssuePreviewAutofixSummary
              key={group.id}
              autofix={autofix}
              groupId={group.id}
            />
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
                  placeholder={t('Add a comment. Tag users with @, or teams with #')}
                />
              </FoldSection>
            </ErrorBoundary>
          </Container>
        </Dividers>
      )}
    </IssueDetailsContextProvider>
  );
}

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

const TitleLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
  overflow: hidden;

  &:hover {
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.tokens.content.secondary};
  }
`;
