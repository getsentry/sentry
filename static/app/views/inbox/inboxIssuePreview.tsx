import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import {AnsiText} from 'sentry/components/ansiText';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {IssueDetailsContextProvider} from 'sentry/views/issueDetails/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/eventDetailsHeader';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {EventUserCounts} from 'sentry/views/issueDetails/header/eventUserCounts';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

type InboxIssueTab = 'activity' | 'telemetry';

interface InboxIssuePreviewProps {
  groupId: string;
}

export function InboxIssuePreview({groupId}: InboxIssuePreviewProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const [tab, setTab] = useState<InboxIssueTab>('activity');
  const {
    data: group,
    isPending,
    isError,
    refetch,
  } = useQuery({
    ...groupApiOptions({
      organizationSlug: organization.slug,
      groupId,
      environments: [],
      expandDerivedData: true,
    }),
    retry: false,
  });
  const {data: event} = useGroupEvent({groupId, eventId: undefined});

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const project = projects.find(p => p.id === group.project.id) ?? group.project;

  return (
    <GroupDataContextProvider group={group} project={project}>
      <Container containerType="inline-size">
        <InboxIssuePreviewHeader group={group} project={project} event={event} />
        <Tabs value={tab} onChange={setTab}>
          <Container padding="0 2xl" borderBottom="primary">
            <TabList>
              <TabList.Item key="activity">{t('Activity')}</TabList.Item>
              <TabList.Item key="telemetry">{t('Telemetry')}</TabList.Item>
            </TabList>
          </Container>
          <TabPanels>
            <TabPanels.Item key="activity">
              <InboxIssueActivity group={group} />
            </TabPanels.Item>
            <TabPanels.Item key="telemetry">
              <PageFiltersContainer
                key={project.id}
                skipLoadLastUsed
                forceProject={project}
                shouldForceProject
              >
                <InboxIssueTelemetry group={group} project={project} event={event} />
              </PageFiltersContainer>
            </TabPanels.Item>
          </TabPanels>
        </Tabs>
      </Container>
    </GroupDataContextProvider>
  );
}

interface InboxIssueSectionProps {
  event: Event | undefined;
  group: Group;
  project: Project;
}

function InboxIssuePreviewHeader({group, project, event}: InboxIssueSectionProps) {
  const {title = ''} = getTitle(group);

  return (
    <Stack>
      <Stack gap="xs" borderBottom="muted" padding="lg 2xl">
        <Flex justify="between" align="center" gap="md">
          <Heading as="h2" size="xl">
            <AnsiText>{title}</AnsiText>
          </Heading>
          <EventUserCounts group={group} project={project} />
        </Flex>
        <EventMessage level={group.level} message={getMessage(group)} type={group.type} />
      </Stack>
      <Flex
        justify="between"
        align="center"
        gap="md"
        wrap="wrap"
        padding="lg 2xl"
        borderBottom="muted"
      >
        <GroupActions group={group} project={project} event={event ?? null} />
        <Flex align="center" gap="0 xl" wrap="wrap">
          <Flex align="center" gap="xs">
            <Text variant="muted">{t('Priority')}</Text>
            <GroupPriority group={group} />
          </Flex>
          <Flex align="center" gap="xs">
            <Text variant="muted">{t('Assignee')}</Text>
            <GroupHeaderAssigneeSelector
              group={group}
              project={project}
              event={event ?? null}
            />
          </Flex>
        </Flex>
      </Flex>
    </Stack>
  );
}

function InboxIssueActivity({group}: Pick<InboxIssueSectionProps, 'group'>) {
  return (
    <Container padding="xl 2xl">
      <ActivitySection
        group={group}
        minHeight={40}
        variant="standalone"
        placeholder={t('Add a comment. Tag users with @, or teams with #')}
      />
    </Container>
  );
}

function InboxIssueTelemetry({group, project, event}: InboxIssueSectionProps) {
  return (
    <IssueDetailsContextProvider>
      <Stack background="secondary">
        <EventDetailsHeader
          group={group}
          event={event}
          project={project}
          showSidebarToggle={false}
        />
        <Container padding="lg 2xl 2xl">
          <GroupEventDetails />
        </Container>
      </Stack>
    </IssueDetailsContextProvider>
  );
}
