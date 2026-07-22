import {Fragment, type ReactNode} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getMessage, getTitle} from 'sentry/utils/events';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {IssueDetailsContextProvider, SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {
  GroupDataContextProvider,
  useGroupData,
} from 'sentry/views/issueDetails/groupDataContext';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {GroupStatusSubtitle} from 'sentry/views/issueDetails/header/groupStatusSubtitle';
import {IssueIdBreadcrumb} from 'sentry/views/issueDetails/header/issueIdBreadcrumb';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {IssuePreviewAutofix} from 'sentry/views/issueDetails/issuePreview/issuePreviewAutofix';
import {IssuePreviewDetails} from 'sentry/views/issueDetails/issuePreview/issuePreviewDetails';
import {ExternalIssueSidebarList} from 'sentry/views/issueDetails/sidebar/externalIssueSidebarList';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

type ChromeRenderer = (children: ReactNode) => ReactNode;

interface IssuePreviewProps {
  groupId: string;
  renderBody?: ChromeRenderer;
  renderHeader?: ChromeRenderer;
}

function renderDefaultHeader(children: ReactNode) {
  return (
    <Container padding="md" borderBottom="muted">
      {children}
    </Container>
  );
}

function renderDefaultBody(children: ReactNode) {
  return (
    <Container flexGrow={1} minHeight={0} overflowY="auto" padding="lg">
      {children}
    </Container>
  );
}

export function IssuePreview({
  groupId,
  renderHeader = renderDefaultHeader,
  renderBody = renderDefaultBody,
}: IssuePreviewProps) {
  const organization = useOrganization();
  const {data: group, isPending, isError} = useGroup({groupId});
  const {projects} = useProjects();
  const project = projects.find(p => p.id === group?.project.id) ?? group?.project;

  const issueDetailsUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/`
  );

  return (
    <Fragment>
      {renderHeader(
        <Flex justify="between" align="center" flex="1" gap="md">
          {group && project && <IssueIdBreadcrumb group={group} project={project} />}
          <Flex justify="end" flex="1">
            <LinkButton to={issueDetailsUrl} size="xs" icon={<IconOpen />}>
              {t('Open Issue')}
            </LinkButton>
          </Flex>
        </Flex>
      )}
      {renderBody(
        <Fragment>
          {isPending && <LoadingIndicator />}
          {isError && <LoadingError />}
          {group && project && (
            <GroupDataContextProvider group={group} project={project}>
              <ErrorBoundary mini>
                <IssuePreviewContent />
              </ErrorBoundary>
            </GroupDataContextProvider>
          )}
        </Fragment>
      )}
    </Fragment>
  );
}

function IssuePreviewContent() {
  const {group, project} = useGroupData();
  const {hasAutofix} = useAiConfig(group, project);
  const {data: event} = useGroupEvent({
    groupId: group.id,
    eventId: 'recommended',
    options: {enabled: true},
  });
  const {title: primaryTitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(getGroupReprocessingStatus(group));

  return (
    <Fragment>
      <Container paddingBottom="lg" borderBottom="muted">
        <Stack gap="xs">
          <Container>
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
            <EventMessage
              level={group.level}
              message={secondaryTitle}
              type={group.type}
            />
          </Container>
          <GroupStatusSubtitle group={group} project={project} />
        </Stack>
      </Container>
      <Flex
        paddingTop="lg"
        paddingBottom="lg"
        borderBottom="muted"
        justify="between"
        align="center"
        wrap="wrap"
        gap="md"
      >
        <GroupActions
          group={group}
          project={project}
          disabled={disableActions}
          event={null}
        />
        <Flex align="center" wrap="wrap" gap="lg">
          <Flex align="center" gap="xs">
            <Text size="sm" variant="muted">
              {t('Priority')}
            </Text>
            <GroupPriority group={group} />
          </Flex>
          <Flex align="center" gap="xs">
            <Text size="sm" variant="muted">
              {t('Assignee')}
            </Text>
            <GroupHeaderAssigneeSelector group={group} project={project} event={null} />
          </Flex>
        </Flex>
      </Flex>
      <Container paddingTop="md">
        <Tabs>
          <Container paddingBottom="md" borderBottom="muted">
            <TabList variant="floating">
              <TabList.Item key="activity">{t('Activity')}</TabList.Item>
              {hasAutofix ? (
                <TabList.Item key="autofix">{t('Autofix')}</TabList.Item>
              ) : null}
              <TabList.Item key="details">{t('Details')}</TabList.Item>
              <TabList.Item key="events" disabled>
                {t('Events')}
              </TabList.Item>
            </TabList>
          </Container>
          <TabPanels>
            <TabPanels.Item key="activity">
              <Container paddingTop="md" paddingLeft="md" paddingRight="md">
                <IssueDetailsContextProvider>
                  {event && (
                    <ErrorBoundary mini>
                      <ExternalIssueSidebarList group={group} event={event} />
                    </ErrorBoundary>
                  )}
                  <ErrorBoundary mini>
                    <SidebarFoldSection
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
                    </SidebarFoldSection>
                  </ErrorBoundary>
                </IssueDetailsContextProvider>
              </Container>
            </TabPanels.Item>
            {hasAutofix ? (
              <TabPanels.Item key="autofix">
                <Container paddingTop="md">
                  <IssuePreviewAutofix group={group} project={project} />
                </Container>
              </TabPanels.Item>
            ) : null}
            <TabPanels.Item key="details">
              <Container paddingTop="md">
                <IssueDetailsContextProvider>
                  <IssuePreviewDetails group={group} project={project} />
                </IssueDetailsContextProvider>
              </Container>
            </TabPanels.Item>
            <TabPanels.Item key="events">
              <Container />
            </TabPanels.Item>
          </TabPanels>
        </Tabs>
      </Container>
    </Fragment>
  );
}
