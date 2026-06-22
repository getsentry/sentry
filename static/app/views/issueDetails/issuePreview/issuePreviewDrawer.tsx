import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
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
import {
  GroupDataContextProvider,
  useGroupData,
} from 'sentry/views/issueDetails/groupDataContext';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {GroupStatusSubtitle} from 'sentry/views/issueDetails/header/groupStatusSubtitle';
import {IssueIdBreadcrumb} from 'sentry/views/issueDetails/header/issueIdBreadcrumb';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

interface IssuePreviewDrawerProps {
  groupId: string;
}

export function IssuePreviewDrawer({groupId}: IssuePreviewDrawerProps) {
  const organization = useOrganization();
  const {data: group, isPending, isError} = useGroup({groupId});
  const {projects} = useProjects();
  const project = projects.find(p => p.id === group?.project.id) ?? group?.project;

  const issueDetailsUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/`
  );

  return (
    <Fragment>
      <DrawerHeader>
        <Flex justify="between" align="center" flex="1">
          {group && project && <IssueIdBreadcrumb group={group} project={project} />}
          <LinkButton
            to={issueDetailsUrl}
            size="xs"
            icon={<IconOpen />}
            style={{marginLeft: 'auto'}}
          >
            {t('Open Issue')}
          </LinkButton>
        </Flex>
      </DrawerHeader>
      <DrawerBody>
        {isPending && <LoadingIndicator />}
        {isError && <LoadingError />}
        {group && project && (
          <GroupDataContextProvider group={group} project={project}>
            <ErrorBoundary mini>
              <IssuePreviewContent />
            </ErrorBoundary>
          </GroupDataContextProvider>
        )}
      </DrawerBody>
    </Fragment>
  );
}

function IssuePreviewContent() {
  const {group, project} = useGroupData();
  const {title: primaryTitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(getGroupReprocessingStatus(group));

  return (
    <Fragment>
      <Container paddingBottom="lg" borderBottom="muted">
        <Flex direction="column" gap="xs">
          <div>
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
          </div>
          <GroupStatusSubtitle group={group} project={project} />
        </Flex>
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
      <Container paddingTop="lg">
        <Container paddingBottom="lg" borderBottom="muted">
          <Tabs value="activity">
            <TabList variant="floating">
              <TabList.Item key="activity">{t('Activity')}</TabList.Item>
              <TabList.Item key="autofix" disabled>
                {t('Autofix')}
              </TabList.Item>
              <TabList.Item key="details" disabled>
                {t('Details')}
              </TabList.Item>
              <TabList.Item key="events" disabled>
                {t('Events')}
              </TabList.Item>
            </TabList>
          </Tabs>
        </Container>
        <Container paddingTop="lg">
          <ActivitySection
            group={group}
            variant="standalone"
            size="md"
            placeholder={t('Add a comment. Tag users with @, or teams with #')}
          />
        </Container>
      </Container>
    </Fragment>
  );
}
