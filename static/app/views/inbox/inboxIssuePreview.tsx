import {Fragment, useMemo, useState, type ReactNode} from 'react';
import {useParams} from 'react-router';
import styled from '@emotion/styled';
import {IconIssues} from '@sentry/icons/issues';
import {IconSeer} from '@sentry/icons/seer';
import {useQuery} from '@tanstack/react-query';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {AnsiText} from 'sentry/components/ansiText';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {AssessImpactButton} from 'sentry/components/issues/impact/assessImpact';
import {ImpactBadge} from 'sentry/components/issues/impact/impactBadge';
import {
  useAssessedImpact,
  useHasImpactAssessment,
} from 'sentry/components/issues/impact/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {getInvestigationPath} from 'sentry/views/investigations/utils';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {IssueDetailsContextProvider} from 'sentry/views/issueDetails/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/eventDetailsHeader';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {
  relatedIssuesApiOptions,
  type RelatedIssue,
} from 'sentry/views/issueDetails/groupRelatedIssues/relatedIssuesApiOptions';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {EventUserCounts} from 'sentry/views/issueDetails/header/eventUserCounts';
import {issueFirstLastReleaseQueryOptions} from 'sentry/views/issueDetails/issueFirstLastReleaseQueryOptions';
import {
  ExternalIssueListContent,
  ExternalIssueListLinkButton,
  useExternalIssueList,
} from 'sentry/views/issueDetails/sidebar/externalIssueList';
import {ParticipantList} from 'sentry/views/issueDetails/sidebar/participantList';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

import {InboxIssueSeen} from './inboxIssueSeen';

type InboxIssueTab = 'overview' | 'telemetry';

interface InboxIssuePreviewProps {
  groupId: string;
}

export default function InboxIssuePreviewRoute() {
  const {id} = useParams<'id'>();
  return id ? <InboxIssuePreview groupId={id} /> : null;
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
          {({TabList, TabPanels}) => (
            <Fragment>
              <Container padding="0 2xl" borderBottom="primary">
                <TabList>
                  <TabList.Item key="overview">{t('Overview')}</TabList.Item>
                  <TabList.Item key="telemetry">{t('Telemetry')}</TabList.Item>
                </TabList>
              </Container>
              <Stack flex="1" height="auto" paddingTop="0">
                {layoutProps => (
                  <TabPanels {...layoutProps}>
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
                        <InboxIssueTelemetry
                          group={group}
                          project={project}
                          event={event}
                        />
                      </PageFiltersContainer>
                    </TabPanels.Item>
                  </TabPanels>
                )}
              </Stack>
            </Fragment>
          )}
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
  const impact = useAssessedImpact(group);
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
        <Flex align="center" gap="md">
          {impact && <ImpactBadge impact={impact} hovercard />}
          {hasParticipants && (
            <ParticipantList
              users={userParticipants}
              teams={teamParticipants}
              hideTimestamp
            />
          )}
        </Flex>
      </Flex>
    </Stack>
  );
}

function InboxIssueOverview({group, project, event}: InboxIssueSectionProps) {
  const {hash} = useLocation();
  const highlightedActivityId = hash.match(/^#activity[-=](.+)$/)?.[1];

  return (
    <IssueDetailsContextProvider scrollContext="pane">
      <Grid flex={1} columns={{zero: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 300px'}}>
        <Stack gap="lg" padding="xl 2xl" minWidth={0}>
          <Heading as="h3" size="md">
            {t('Issue timeline')}
          </Heading>
          <ActivitySection
            group={group}
            highlightedActivityId={highlightedActivityId}
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
      <ErrorBoundary mini>
        <InboxImpactField group={group} />
      </ErrorBoundary>
      <SidebarField label={t('Priority')}>
        <GroupPriority group={group} />
      </SidebarField>
      <ErrorBoundary mini>
        <InboxIssueSeenFields group={group} />
      </ErrorBoundary>
      <ErrorBoundary mini>
        <SidebarField label={t('Related')}>
          <InboxIssueRelated group={group} />
        </SidebarField>
      </ErrorBoundary>
      <ErrorBoundary mini>
        <InboxIssueExternalLinks group={group} event={event} />
      </ErrorBoundary>
    </Stack>
  );
}

function InboxImpactField({group}: {group: Group}) {
  const impact = useAssessedImpact(group);
  const canAssessImpact = useHasImpactAssessment();

  if (!impact && !canAssessImpact) {
    return null;
  }

  return (
    <SidebarField label={t('Impact')} leadingItems={<FeatureBadge type="alpha" />}>
      {impact ? (
        <Flex>
          <ImpactBadge impact={impact} hovercard />
        </Flex>
      ) : (
        <AssessImpactButton group={group} />
      )}
    </SidebarField>
  );
}

function InboxIssueSeenFields({group}: {group: Group}) {
  const organization = useOrganization();
  const {data: releases} = useQuery(
    issueFirstLastReleaseQueryOptions({
      groupId: group.id,
      organizationSlug: organization.slug,
    })
  );

  return (
    <Fragment>
      <SidebarField label={t('Last seen')}>
        <InboxIssueSeen
          date={group.lastSeen}
          label={t('Last seen')}
          project={group.project}
          releaseVersion={releases?.lastRelease?.version}
        />
      </SidebarField>
      <SidebarField label={t('First seen')}>
        <InboxIssueSeen
          date={group.firstSeen}
          label={t('First seen')}
          project={group.project}
          releaseVersion={releases?.firstRelease?.version}
        />
      </SidebarField>
    </Fragment>
  );
}

const RELATED_SHOWN = 3;

function InboxIssueRelated({group}: Pick<InboxIssueSectionProps, 'group'>) {
  const organization = useOrganization();
  // The limit applies to each type. The endpoint lists issues matched by more types first.
  const {data, isPending, isError} = useQuery(
    relatedIssuesApiOptions({organization, groupId: group.id, limit: RELATED_SHOWN})
  );

  if (isPending) {
    return <Placeholder height="60px" />;
  }
  if (isError) {
    return <Text variant="muted">{t('Unable to load related resources')}</Text>;
  }

  // Investigations come before issues
  const rows = [
    ...data.investigations.map(({investigation, reason, hypothesisStatement}) => (
      <InboxIssueRelatedRow
        key={`investigation-${investigation.id}`}
        icon={<IconSeer size="sm" />}
        to={getInvestigationPath(organization.slug, investigation.id)}
        label={investigation.title}
        title={investigation.title}
        reason={reason ?? t('Hypothesis: %s', hypothesisStatement)}
      />
    )),
    ...data.data.map(({issue, relations}) => (
      <InboxIssueRelatedRow
        key={`issue-${issue.id}`}
        icon={<IconIssues size="sm" />}
        to={normalizeUrl(`/organizations/${organization.slug}/issues/${issue.id}/`)}
        label={`${issue.shortId} – ${issue.title}`}
        // Matches how the issue stream shows an issue: its type, then its message
        title={getTitle(issue).title ?? issue.title}
        message={getMessage(issue)}
        reason={relations.map(getRelationLabel).join(' · ')}
      />
    )),
  ].slice(0, RELATED_SHOWN);

  if (rows.length === 0) {
    // If we have no related resources that means either every relation type failed or wasn't applicable OR
    // at least one relation type worked but returned no results. Filter out investigations since they can't fail.
    const issueStatuses = data.meta.types
      .filter(meta => meta.type !== 'investigations')
      .map(meta => meta.status);
    const issueTypesFailed =
      issueStatuses.includes('unavailable') && !issueStatuses.includes('ok');
    return (
      <Text variant="muted">
        {issueTypesFailed
          ? t('Unable to load related resources')
          : t('No related resources')}
      </Text>
    );
  }

  return <Stack gap="md">{rows}</Stack>;
}

/**
 * Why the endpoint matched a related issue, for its tooltip.
 */
function getRelationLabel(relation: RelatedIssue['relations'][number]) {
  switch (relation.type) {
    case 'similar_stacktrace':
      return t('Similar stack trace (%s)', formatPercentage(relation.score, 0));
    case 'same_trace':
      return t('Same trace');
    case 'same_title':
      return t('Same title');
    case 'same_supergroup':
      return t('Same supergroup');
    case 'contributing':
      return t('Contributed to this alert');
  }
}

/**
 * A related issue or investigation. The row cuts off a long label, so its tooltip shows the
 * title, the message when there is one, and why it's related.
 */
function InboxIssueRelatedRow({
  icon,
  to,
  label,
  title,
  reason,
  message,
}: {
  icon: ReactNode;
  label: string;
  reason: string;
  title: string;
  to: string;
  message?: string;
}) {
  return (
    <Flex gap="sm" align="center" alignSelf="start" minWidth={0} maxWidth="100%">
      {linkProps => (
        <Tooltip
          skipWrapper
          maxWidth={350}
          title={
            <Stack gap="xs">
              <Text bold>
                <AnsiText>{title}</AnsiText>
              </Text>
              {message ? (
                <Text>
                  <AnsiText>{message}</AnsiText>
                </Text>
              ) : null}
              <Text variant="muted">{reason}</Text>
            </Stack>
          }
        >
          <IssueTitleLink {...linkProps} to={to}>
            {icon}
            <Text ellipsis>{label}</Text>
          </IssueTitleLink>
        </Tooltip>
      )}
    </Flex>
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
  leadingItems?: React.ReactNode;
}

function SidebarField({label, actions, leadingItems, children}: SidebarFieldProps) {
  return (
    <Stack gap="md">
      <Flex justify="between" align="center" gap="md">
        <Flex align="center" gap="md">
          {leadingItems}
          <Heading as="h3" size="md">
            {label}
          </Heading>
        </Flex>
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
