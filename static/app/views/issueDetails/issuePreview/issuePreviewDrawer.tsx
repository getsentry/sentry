import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {GroupStatusSubtitle} from 'sentry/views/issueDetails/header/groupStatusSubtitle';
import {IssueIdBreadcrumb} from 'sentry/views/issueDetails/header/issueIdBreadcrumb';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

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
          <ErrorBoundary mini>
            <IssuePreviewContent group={group} project={project} />
          </ErrorBoundary>
        )}
      </DrawerBody>
    </Fragment>
  );
}

function IssuePreviewContent({
  group,
  project,
}: {
  group: NonNullable<ReturnType<typeof useGroup>['data']>;
  project: Project;
}) {
  const {title: primaryTitle} = getTitle(group);
  const secondaryTitle = getMessage(group);

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
