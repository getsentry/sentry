import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Heading} from '@sentry/scraps/text';

import {AnsiText} from 'sentry/components/ansiText';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
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
import {
  ExternalIssueListContent,
  ExternalIssueListLinkButton,
  useExternalIssueList,
} from 'sentry/views/issueDetails/sidebar/externalIssueList';
import {FirstLastSeenSection} from 'sentry/views/issueDetails/sidebar/firstLastSeenSection';
import {ParticipantList} from 'sentry/views/issueDetails/sidebar/participantList';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

type InboxIssueTab = 'overview' | 'telemetry';

interface InboxIssuePreviewProps {
  groupId: string;
}

export function InboxIssuePreview({groupId}: InboxIssuePreviewProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const [tab, setTab] = useState<InboxIssueTab>('overview');
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
      <Stack flex={1} containerType="inline-size">
        <InboxIssuePreviewHeader group={group} project={project} event={event} />
        <Tabs value={tab} onChange={setTab}>
          <Container padding="0 2xl" borderBottom="primary">
            <TabList>
              <TabList.Item key="overview">{t('Overview')}</TabList.Item>
              <TabList.Item key="telemetry">{t('Telemetry')}</TabList.Item>
            </TabList>
          </Container>
          <FullHeightTabPanels>
            <TabPanels.Item key="overview">
              <InboxIssueOverview group={group} project={project} event={event} />
            </TabPanels.Item>
            <TabPanels.Item key="telemetry">
              <PageFiltersContainer
                key={project.id}
                skipLoadLastUsed
                skipInitializeUrlParams
                disablePersistence
                forceProject={project}
                shouldForceProject
              >
                <InboxIssueTelemetry group={group} project={project} event={event} />
              </PageFiltersContainer>
            </TabPanels.Item>
          </FullHeightTabPanels>
        </Tabs>
      </Stack>
    </GroupDataContextProvider>
  );
}

interface InboxIssueSectionProps {
  event: Event | undefined;
  group: Group;
  project: Project;
}

function InboxIssuePreviewHeader({group, project, event}: InboxIssueSectionProps) {
  const organization = useOrganization();
  const {title = ''} = getTitle(group);
  const {userParticipants, teamParticipants} = useMemo(
    () => ({
      userParticipants: group.participants.filter(
        (p): p is UserParticipant => p.type === 'user'
      ),
      teamParticipants: group.participants.filter(
        (p): p is TeamParticipant => p.type === 'team'
      ),
    }),
    [group.participants]
  );
  const hasParticipants = userParticipants.length > 0 || teamParticipants.length > 0;

  return (
    <Stack gap="lg" padding="lg 2xl">
      <Grid columns="minmax(0, 1fr) auto" gap="xs xl" align="start">
        <Stack gap="xs" minWidth={0}>
          <Heading as="h2" size="xl">
            <IssueTitleLink
              to={normalizeUrl(`/organizations/${organization.slug}/issues/${group.id}/`)}
            >
              <AnsiText>{title}</AnsiText>
            </IssueTitleLink>
          </Heading>
          <EventMessage
            level={group.level}
            message={getMessage(group)}
            type={group.type}
          />
        </Stack>
        <EventUserCounts group={group} project={project} />
      </Grid>
      <Flex justify="between" align="center" gap="md" wrap="wrap">
        <GroupActions group={group} project={project} event={event ?? null} />
        {hasParticipants && (
          <ParticipantList
            users={userParticipants}
            teams={teamParticipants}
            hideTimestamp
          />
        )}
      </Flex>
    </Stack>
  );
}

function InboxIssueOverview({group, project, event}: InboxIssueSectionProps) {
  return (
    <IssueDetailsContextProvider scrollContext="pane">
      <Grid flex={1} columns={{zero: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 300px'}}>
        <Stack gap="lg" padding="xl 2xl" minWidth={0}>
          <Heading as="h3" size="md">
            {t('Issue timeline')}
          </Heading>
          <ActivitySection
            group={group}
            minHeight={40}
            variant="standalone"
            placeholder={t('Add a comment. Tag users with @, or teams with #')}
          />
        </Stack>
        <Container
          as="aside"
          aria-label={t('Issue overview')}
          padding="xl 2xl"
          borderLeft={{zero: 'none', xl: 'primary'}}
          borderTop={{zero: 'primary', xl: 'none'}}
          minWidth={0}
        >
          <InboxIssueSidebar group={group} project={project} event={event} />
        </Container>
      </Grid>
    </IssueDetailsContextProvider>
  );
}

function InboxIssueSidebar({group, project, event}: InboxIssueSectionProps) {
  return (
    <Stack gap="xl">
      <SidebarField label={t('Assignee')}>
        <Flex>
          <GroupHeaderAssigneeSelector
            group={group}
            project={project}
            event={event ?? null}
          />
        </Flex>
      </SidebarField>
      <SidebarField label={t('Priority')}>
        <GroupPriority group={group} />
      </SidebarField>
      <ErrorBoundary mini>
        <FirstLastSeenSection group={group} event={event} />
      </ErrorBoundary>
      <ErrorBoundary mini>
        <InboxIssueExternalLinks group={group} event={event} />
      </ErrorBoundary>
    </Stack>
  );
}

function InboxIssueExternalLinks({
  group,
  event,
}: Pick<InboxIssueSectionProps, 'group' | 'event'>) {
  const externalIssues = useExternalIssueList({group, event});

  return (
    <SidebarField
      label={t('External links')}
      actions={<ExternalIssueListLinkButton {...externalIssues} />}
    >
      <ExternalIssueListContent {...externalIssues} />
    </SidebarField>
  );
}

interface SidebarFieldProps {
  children: React.ReactNode;
  label: string;
  actions?: React.ReactNode;
}

function SidebarField({label, actions, children}: SidebarFieldProps) {
  return (
    <Stack gap="md">
      <Flex justify="between" align="center" gap="md">
        <Heading as="h3" size="md">
          {label}
        </Heading>
        {actions}
      </Flex>
      <Container>{children}</Container>
    </Stack>
  );
}

function InboxIssueTelemetry({group, project, event}: InboxIssueSectionProps) {
  return (
    <IssueDetailsContextProvider scrollContext="pane">
      <Stack flex={1} background="secondary">
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

const IssueTitleLink = styled(Link)`
  color: inherit;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    color: inherit;
  }

  &:hover {
    text-decoration: underline;
  }
`;

// Lets the selected panel fill the rest of the preview's height
const FullHeightTabPanels = styled(TabPanels)`
  flex: 1;
  height: auto;
  display: flex;
  flex-direction: column;
  padding-top: 0;
`;
