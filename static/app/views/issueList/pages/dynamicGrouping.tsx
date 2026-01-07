import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Checkbox} from 'sentry/components/core/checkbox';
import {InlineCode} from 'sentry/components/core/code/inlineCode';
import {Disclosure} from 'sentry/components/core/disclosure';
import {Link} from 'sentry/components/core/link';
import {TextArea} from 'sentry/components/core/textarea';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import TimesTag from 'sentry/components/group/inboxBadges/timesTag';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Redirect from 'sentry/components/redirect';
import TimeSince from 'sentry/components/timeSince';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {
  IconArrow,
  IconCalendar,
  IconChevron,
  IconClock,
  IconClose,
  IconCopy,
  IconEllipsis,
  IconFire,
  IconRefresh,
  IconSeer,
  IconStar,
  IconUpload,
  IconUser,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {GroupStatus, GroupSubstatus} from 'sentry/types/group';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';

const CLUSTERS_PER_PAGE = 20;

interface AssignedEntity {
  email: string | null;
  id: string;
  name: string;
  type: string;
}

interface ClusterSummary {
  assignedTo: AssignedEntity[];
  cluster_avg_similarity: number | null;
  cluster_id: number;
  cluster_min_similarity: number | null;
  cluster_size: number | null;
  description: string;
  fixability_score: number | null;
  group_ids: number[];
  issue_titles: string[];
  project_ids: number[];
  summary: string | null;
  tags: string[];
  title: string;
  code_area_tags?: string[];
  error_type?: string;
  error_type_tags?: string[];
  impact?: string;
  location?: string;
  service_tags?: string[];
}

function formatClusterInfoForClipboard(cluster: ClusterSummary): string {
  const lines: string[] = [];

  lines.push(`## ${cluster.title}`);
  lines.push('');

  if (cluster.summary) {
    lines.push('### Summary');
    lines.push(cluster.summary);
    lines.push('');
  }

  lines.push('### Group IDs');
  lines.push(cluster.group_ids.join(', '));

  return lines.join('\n');
}

function formatClusterPromptForSeer(cluster: ClusterSummary): string {
  const message = formatClusterInfoForClipboard(cluster);
  return `I'd like to investigate this cluster of issues:\n\n${message}\n\nPlease help me understand the root cause and potential fixes for these related issues.`;
}

function renderWithInlineCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  if (parts.length === 1) {
    return text;
  }
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <InlineCode key={index}>{part.slice(1, -1)}</InlineCode>;
    }
    return part;
  });
}

interface TopIssuesResponse {
  data: ClusterSummary[];
  last_updated?: string;
}

function CompactIssuePreview({group}: {group: Group}) {
  const {subtitle} = getTitle(group);

  const items = [
    group.project ? (
      <ProjectBadge project={group.project} avatarSize={12} hideName disableLink />
    ) : null,
    group.isUnhandled ? <UnhandledTag /> : null,
    group.count ? (
      <Text size="xs" bold>
        {tn('%s event', '%s events', group.count)}
      </Text>
    ) : null,
    group.firstSeen || group.lastSeen ? (
      <TimesTag lastSeen={group.lastSeen} firstSeen={group.firstSeen} />
    ) : null,
  ].filter(Boolean);

  return (
    <Flex direction="column" gap="xs">
      <IssueTitle>
        <EventOrGroupTitle data={group} withStackTracePreview />
      </IssueTitle>
      <IssueMessage
        data={group}
        level={group.level}
        message={getMessage(group)}
        type={group.type}
      />
      {subtitle && (
        <Text size="sm" variant="muted" ellipsis>
          {subtitle}
        </Text>
      )}
      {items.length > 0 && (
        <Flex wrap="wrap" gap="sm" align="center">
          {items.map((item, i) => (
            <Fragment key={i}>
              {item}
              {i < items.length - 1 ? <MetaSeparator /> : null}
            </Fragment>
          ))}
        </Flex>
      )}
    </Flex>
  );
}

interface ClusterStats {
  firstSeen: string | null;
  hasRegressedIssues: boolean;
  isEscalating: boolean;
  isPending: boolean;
  lastSeen: string | null;
  newIssuesCount: number;
  totalEvents: number;
  totalUsers: number;
}

function useClusterStats(groupIds: number[]): ClusterStats {
  const organization = useOrganization();

  const {data: groups, isPending} = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          group: groupIds,
          query: `issue.id:[${groupIds.join(',')}]`,
        },
      },
    ],
    {
      staleTime: 60000,
      enabled: groupIds.length > 0,
    }
  );

  return useMemo(() => {
    if (isPending || !groups || groups.length === 0) {
      return {
        totalEvents: 0,
        totalUsers: 0,
        firstSeen: null,
        lastSeen: null,
        newIssuesCount: 0,
        hasRegressedIssues: false,
        isEscalating: false,
        isPending,
      };
    }

    let totalEvents = 0;
    let totalUsers = 0;
    let earliestFirstSeen: Date | null = null;
    let latestLastSeen: Date | null = null;

    // Calculate new issues (first seen within last week)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let newIssuesCount = 0;

    // Check for regressed issues
    let hasRegressedIssues = false;

    // Calculate escalation by summing event stats across all issues
    // We'll compare the first half of the 24h stats to the second half
    let firstHalfEvents = 0;
    let secondHalfEvents = 0;

    for (const group of groups) {
      totalEvents += parseInt(group.count, 10) || 0;
      totalUsers += group.userCount || 0;

      if (group.firstSeen) {
        const firstSeenDate = new Date(group.firstSeen);
        if (!earliestFirstSeen || firstSeenDate < earliestFirstSeen) {
          earliestFirstSeen = firstSeenDate;
        }
        // Check if this issue is new (first seen within last week)
        if (firstSeenDate >= oneWeekAgo) {
          newIssuesCount++;
        }
      }

      if (group.lastSeen) {
        const lastSeenDate = new Date(group.lastSeen);
        if (!latestLastSeen || lastSeenDate > latestLastSeen) {
          latestLastSeen = lastSeenDate;
        }
      }

      // Check for regressed substatus
      if (group.substatus === GroupSubstatus.REGRESSED) {
        hasRegressedIssues = true;
      }

      // Aggregate 24h stats for escalation detection
      const stats24h = group.stats?.['24h'];
      if (stats24h && stats24h.length > 0) {
        const midpoint = Math.floor(stats24h.length / 2);
        for (let i = 0; i < stats24h.length; i++) {
          const eventCount = stats24h[i]?.[1] ?? 0;
          if (i < midpoint) {
            firstHalfEvents += eventCount;
          } else {
            secondHalfEvents += eventCount;
          }
        }
      }
    }

    // Determine if escalating: second half has >1.5x events compared to first half
    // Only consider escalating if there were events in the first half (avoid division by zero)
    const isEscalating = firstHalfEvents > 0 && secondHalfEvents > firstHalfEvents * 1.5;

    return {
      totalEvents,
      totalUsers,
      firstSeen: earliestFirstSeen?.toISOString() ?? null,
      lastSeen: latestLastSeen?.toISOString() ?? null,
      newIssuesCount,
      hasRegressedIssues,
      isEscalating,
      isPending,
    };
  }, [groups, isPending]);
}

function ClusterIssues({groupIds}: {groupIds: number[]}) {
  const organization = useOrganization();
  const previewGroupIds = groupIds.slice(0, 3);

  const {data: groups, isPending} = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          group: previewGroupIds,
          query: `issue.id:[${previewGroupIds.join(',')}]`,
        },
      },
    ],
    {
      staleTime: 60000,
    }
  );

  if (isPending || !groups || groups.length === 0) {
    return null;
  }

  return (
    <Flex direction="column" gap="sm">
      {groups.map(group => (
        <IssuePreviewLink
          key={group.id}
          to={`/organizations/${organization.slug}/issues/${group.id}/`}
        >
          <CompactIssuePreview group={group} />
        </IssuePreviewLink>
      ))}
    </Flex>
  );
}

interface ClusterCardProps {
  cluster: ClusterSummary;
  onDismiss: (clusterId: number) => void;
  filterByEscalating?: boolean;
  filterByRegressed?: boolean;
}

function ClusterCard({
  cluster,
  filterByRegressed,
  filterByEscalating,
  onDismiss,
}: ClusterCardProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [activeTab, setActiveTab] = useState<'summary' | 'root-cause' | 'issues'>(
    'summary'
  );
  const clusterStats = useClusterStats(cluster.group_ids);
  const {copy} = useCopyToClipboard();
  const {projects: allProjects} = useLegacyStore(ProjectsStore);

  // Get projects for this cluster
  const clusterProjects = useMemo(() => {
    const projectIdStrings = cluster.project_ids.map(id => String(id));
    return allProjects.filter(project => projectIdStrings.includes(project.id));
  }, [allProjects, cluster.project_ids]);

  // Track the Seer Explorer run ID for this cluster so subsequent clicks reopen the same chat
  const seerRunIdRef = useRef<number | null>(null);

  const handleSendToSeer = useCallback(() => {
    if (seerRunIdRef.current) {
      // Reopen existing chat
      openSeerExplorer({runId: seerRunIdRef.current});
    } else {
      // Start a new chat with the cluster prompt
      openSeerExplorer({
        startNewRun: true,
        initialMessage: formatClusterPromptForSeer(cluster),
        onRunCreated: runId => {
          seerRunIdRef.current = runId;
        },
      });
    }
  }, [cluster]);

  const handleCopyMarkdown = () => {
    copy(formatClusterInfoForClipboard(cluster));
  };

  const handleResolve = useCallback(() => {
    openConfirmModal({
      header: t('Resolve All Issues in Cluster'),
      message: t(
        'Are you sure you want to resolve all %s issues in this cluster?.',
        cluster.group_ids.length
      ),
      confirmText: t('Resolve All'),
      onConfirm: () => {
        bulkUpdate(
          api,
          {
            orgId: organization.slug,
            itemIds: cluster.group_ids.map(String),
            data: {status: GroupStatus.RESOLVED},
            project: selection.projects,
            environment: selection.environments,
            ...selection.datetime,
          },
          {}
        );
      },
    });
  }, [api, cluster.group_ids, organization.slug, selection]);

  const handleArchive = useCallback(() => {
    openConfirmModal({
      header: t('Archive All Issues in Cluster'),
      message: t(
        'Are you sure you want to archive all %s issues in this cluster?.',
        cluster.group_ids.length
      ),
      confirmText: t('Archive All'),
      onConfirm: () => {
        bulkUpdate(
          api,
          {
            orgId: organization.slug,
            itemIds: cluster.group_ids.map(String),
            data: {
              status: GroupStatus.IGNORED,
              statusDetails: {},
              substatus: GroupSubstatus.ARCHIVED_UNTIL_ESCALATING,
            },
            project: selection.projects,
            environment: selection.environments,
            ...selection.datetime,
          },
          {}
        );
      },
    });
  }, [api, cluster.group_ids, organization.slug, selection]);

  const handleDismiss = useCallback(() => {
    openConfirmModal({
      header: t('Dismiss Cluster'),
      message: t('This will hide this cluster from your personal view.'),
      confirmText: t('Dismiss'),
      onConfirm: () => {
        onDismiss(cluster.cluster_id);
      },
    });
  }, [onDismiss, cluster.cluster_id]);

  const allTags = useMemo(() => {
    return [
      ...new Set([
        ...(cluster.error_type_tags ?? []),
        ...(cluster.code_area_tags ?? []),
        ...(cluster.service_tags ?? []),
      ]),
    ];
  }, [cluster.error_type_tags, cluster.code_area_tags, cluster.service_tags]);

  // Apply filters - hide card if it doesn't match active filters
  // Only filter once stats are loaded to avoid hiding cards prematurely
  if (!clusterStats.isPending) {
    if (filterByRegressed && !clusterStats.hasRegressedIssues) {
      return null;
    }
    if (filterByEscalating && !clusterStats.isEscalating) {
      return null;
    }
  }

  return (
    <CardContainer>
      <CardHeader>
        {cluster.impact && (
          <ClusterTitleLink
            to={`/organizations/${organization.slug}/issues/top-issues/?cluster=${cluster.cluster_id}`}
          >
            {cluster.impact}
            <Text
              as="span"
              size="md"
              variant="muted"
              style={{fontWeight: 'normal', marginLeft: space(1)}}
            >
              [CLUSTER-{cluster.cluster_id}]
            </Text>
          </ClusterTitleLink>
        )}
        {!clusterStats.isPending &&
          (clusterStats.newIssuesCount > 0 ||
            clusterStats.hasRegressedIssues ||
            clusterStats.isEscalating) && (
            <ClusterStatusTags>
              {clusterStats.newIssuesCount > 0 && (
                <StatusTag color="purple">
                  <IconStar size="xs" />
                  <Text size="xs">
                    {tn(
                      '%s new issue this week',
                      '%s new issues this week',
                      clusterStats.newIssuesCount
                    )}
                  </Text>
                </StatusTag>
              )}
              {clusterStats.hasRegressedIssues && (
                <StatusTag color="yellow">
                  <IconRefresh size="xs" />
                  <Text size="xs">{t('Has regressed issues')}</Text>
                </StatusTag>
              )}
              {clusterStats.isEscalating && (
                <StatusTag color="red">
                  <IconArrow direction="up" size="xs" />
                  <Text size="xs">{t('Escalating')}</Text>
                </StatusTag>
              )}
            </ClusterStatusTags>
          )}
        <StatsRow>
          <ClusterStats>
            <StatItem>
              <IconFire size="xs" variant="muted" />
              {clusterStats.isPending ? (
                <Text size="xs" variant="muted">
                  –
                </Text>
              ) : (
                <Text size="xs">
                  <Text size="xs" bold as="span">
                    {clusterStats.totalEvents.toLocaleString()}
                  </Text>{' '}
                  {tn('event', 'events', clusterStats.totalEvents)}
                </Text>
              )}
            </StatItem>
            <StatItem>
              <IconUser size="xs" variant="muted" />
              {clusterStats.isPending ? (
                <Text size="xs" variant="muted">
                  –
                </Text>
              ) : (
                <Text size="xs">
                  <Text size="xs" bold as="span">
                    {clusterStats.totalUsers.toLocaleString()}
                  </Text>{' '}
                  {tn('user', 'users', clusterStats.totalUsers)}
                </Text>
              )}
            </StatItem>
          </ClusterStats>
          {!clusterStats.isPending &&
            (clusterStats.firstSeen || clusterStats.lastSeen) && (
              <TimeStats>
                {clusterStats.lastSeen && (
                  <StatItem>
                    <IconClock size="xs" variant="muted" />
                    <TimeSince
                      tooltipPrefix={t('Last Seen')}
                      date={clusterStats.lastSeen}
                      suffix={t('ago')}
                      unitStyle="short"
                    />
                  </StatItem>
                )}
                {clusterStats.firstSeen && (
                  <StatItem>
                    <IconCalendar size="xs" variant="muted" />
                    <TimeSince
                      tooltipPrefix={t('First Seen')}
                      date={clusterStats.firstSeen}
                      suffix={t('old')}
                      unitStyle="short"
                    />
                  </StatItem>
                )}
              </TimeStats>
            )}
        </StatsRow>
      </CardHeader>

      <TabSection>
        <TabBar>
          <Tab isActive={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>
            {t('Summary')}
          </Tab>
          <Tab
            isActive={activeTab === 'root-cause'}
            onClick={() => setActiveTab('root-cause')}
          >
            {t('Root Cause')}
          </Tab>
          <Tab isActive={activeTab === 'issues'} onClick={() => setActiveTab('issues')}>
            {t('Preview Issues')}
          </Tab>
        </TabBar>
        <TabContent>
          {activeTab === 'summary' && (
            <Flex direction="column" gap="md">
              <StructuredInfo>
                {cluster.error_type && (
                  <InfoRow>
                    <InfoLabel>{t('Error')}</InfoLabel>
                    <InfoValue>{cluster.error_type}</InfoValue>
                  </InfoRow>
                )}
                {cluster.location && (
                  <InfoRow>
                    <InfoLabel>{t('Location')}</InfoLabel>
                    <InfoValue>{cluster.location}</InfoValue>
                  </InfoRow>
                )}
              </StructuredInfo>
              {allTags.length > 0 && (
                <TagsContainer>
                  {allTags.map(tag => (
                    <TagPill key={tag}>{tag}</TagPill>
                  ))}
                </TagsContainer>
              )}
            </Flex>
          )}
          {activeTab === 'root-cause' &&
            (cluster.summary ? (
              <DescriptionText>{renderWithInlineCode(cluster.summary)}</DescriptionText>
            ) : (
              <Text size="sm" variant="muted">
                {t('No root cause analysis available')}
              </Text>
            ))}
          {activeTab === 'issues' && <ClusterIssues groupIds={cluster.group_ids} />}
        </TabContent>
      </TabSection>

      <CardFooter>
        {clusterProjects.length > 0 && (
          <Tooltip
            isHoverable
            overlayStyle={{maxWidth: 300}}
            title={
              <Flex direction="column" gap="xs">
                {clusterProjects.map(project => (
                  <Flex key={project.id} align="center" gap="xs">
                    <ProjectBadge
                      project={project}
                      avatarSize={12}
                      hideName
                      disableLink
                    />
                    <Text size="xs">{project.slug}</Text>
                  </Flex>
                ))}
              </Flex>
            }
          >
            <ProjectAvatars>
              {clusterProjects.slice(0, 3).map(project => (
                <ProjectBadge
                  key={project.id}
                  project={project}
                  avatarSize={16}
                  hideName
                  disableLink
                />
              ))}
              {clusterProjects.length > 3 && (
                <MoreProjectsCount>+{clusterProjects.length - 3}</MoreProjectsCount>
              )}
            </ProjectAvatars>
          </Tooltip>
        )}
        <FooterActions>
          <ButtonBar merged gap="0">
            <SeerButton
              size="sm"
              priority="primary"
              icon={<IconSeer size="xs" />}
              onClick={handleSendToSeer}
            >
              {t('Explore with Seer')}
            </SeerButton>
            <DropdownMenu
              items={[
                {
                  key: 'copy-markdown',
                  label: t('Copy as markdown for agents'),
                  leadingItems: <IconCopy size="sm" />,
                  onAction: handleCopyMarkdown,
                },
              ]}
              trigger={(triggerProps, isOpen) => (
                <SeerDropdownTrigger
                  {...triggerProps}
                  size="sm"
                  priority="primary"
                  icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
                  aria-label={t('More options')}
                />
              )}
              position="bottom-end"
            />
          </ButtonBar>
          <Link
            to={`/organizations/${organization.slug}/issues/?query=issue.id:[${cluster.group_ids.join(',')}]`}
          >
            <Button size="sm">
              {t('View All Issues') + ` (${cluster.group_ids.length})`}
            </Button>
          </Link>
          <DropdownMenu
            items={[
              {
                key: 'resolve',
                label: t('Resolve All'),
                onAction: handleResolve,
              },
              {
                key: 'archive',
                label: t('Archive All'),
                onAction: handleArchive,
              },
              {
                key: 'dismiss',
                label: t('Dismiss'),
                onAction: handleDismiss,
              },
            ]}
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                size="sm"
                icon={<IconEllipsis size="sm" />}
                aria-label={t('More actions')}
              />
            )}
            position="bottom-end"
          />
        </FooterActions>
      </CardFooter>
    </CardContainer>
  );
}

function DynamicGrouping() {
  const organization = useOrganization();
  const user = useUser();
  const {teams: userTeams} = useUserTeams();
  const {selection} = usePageFilters();
  const [filterByAssignedToMe, setFilterByAssignedToMe] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [jsonInputValue, setJsonInputValue] = useState('');
  const [customClusterData, setCustomClusterData] = useState<ClusterSummary[] | null>(
    null
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [disableFilters, setDisableFilters] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [visibleClusterCount, setVisibleClusterCount] = useState(CLUSTERS_PER_PAGE);
  const [filterByRegressed, setFilterByRegressed] = useState(false);
  const [filterByEscalating, setFilterByEscalating] = useState(false);
  const [dismissedClusterIds, setDismissedClusterIds] = useLocalStorageState<number[]>(
    `top-issues-dismissed-clusters:${organization.slug}`,
    []
  );

  const handleDismissCluster = (clusterId: number) => {
    setDismissedClusterIds(prev => [...prev, clusterId]);
  };

  // Fetch cluster data from API
  const {data: topIssuesResponse, isPending} = useApiQuery<TopIssuesResponse>(
    [`/organizations/${organization.slug}/top-issues/`],
    {
      staleTime: 60000,
      enabled: customClusterData === null, // Only fetch if no custom data
    }
  );

  const handleParseJson = () => {
    try {
      const parsed = JSON.parse(jsonInputValue);
      const clusters = Array.isArray(parsed) ? parsed : parsed?.data;
      if (!Array.isArray(clusters)) {
        setJsonError(t('JSON must be an array or have a "data" property with an array'));
        return;
      }
      setCustomClusterData(clusters as ClusterSummary[]);
      setJsonError(null);
      setShowJsonInput(false);
    } catch (e) {
      setJsonError(t('Invalid JSON: %s', e instanceof Error ? e.message : String(e)));
    }
  };

  const handleClearCustomData = () => {
    setCustomClusterData(null);
    setJsonInputValue('');
    setJsonError(null);
    setDisableFilters(false);
  };

  const isUsingCustomData = customClusterData !== null;

  // Extract all unique teams from the cluster data (for dev tools filter UI)
  const teamsInData = useMemo(() => {
    const data = topIssuesResponse?.data ?? [];
    const teamMap = new Map<string, {id: string; name: string}>();
    for (const cluster of data) {
      for (const entity of cluster.assignedTo ?? []) {
        if (entity.type === 'team' && !teamMap.has(entity.id)) {
          teamMap.set(entity.id, {id: entity.id, name: entity.name});
        }
      }
    }
    return Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [topIssuesResponse?.data]);

  const isTeamFilterActive = selectedTeamIds.size > 0;

  const handleAssignedToMeChange = (checked: boolean) => {
    setFilterByAssignedToMe(checked);
    if (checked) {
      setSelectedTeamIds(new Set());
    }
  };

  const handleTeamToggle = (teamId: string) => {
    const next = new Set(selectedTeamIds);
    next.has(teamId) ? next.delete(teamId) : next.add(teamId);

    setSelectedTeamIds(next);
    if (next.size > 0) {
      setFilterByAssignedToMe(false);
    }
  };

  const filteredAndSortedClusters = useMemo(() => {
    const clusterData = customClusterData ?? topIssuesResponse?.data ?? [];

    if (isUsingCustomData && disableFilters) {
      return clusterData;
    }

    // Apply project filter and require structured fields
    const baseFiltered = clusterData.filter(cluster => {
      // Only show clusters with the required structured fields
      if (!cluster.error_type || !cluster.impact || !cluster.location) {
        return false;
      }

      if (dismissedClusterIds.includes(cluster.cluster_id)) {
        return false;
      }

      if (
        selection.projects.length > 0 &&
        !selection.projects.includes(ALL_ACCESS_PROJECTS)
      ) {
        if (!cluster.project_ids.some(pid => selection.projects.includes(pid))) {
          return false;
        }
      }

      return true;
    });

    // Find clusters assigned to current user or their teams
    const assignedToMe = baseFiltered.filter(cluster =>
      cluster.assignedTo?.some(
        entity =>
          (entity.type === 'user' && entity.id === user.id) ||
          (entity.type === 'team' && userTeams.some(team => team.id === entity.id))
      )
    );

    // By default, show only clusters assigned to me if there are enough (>=10)
    const MIN_CLUSTERS_THRESHOLD = 10;
    let result =
      assignedToMe.length >= MIN_CLUSTERS_THRESHOLD ? assignedToMe : baseFiltered;

    // Manual filters override the default
    if (filterByAssignedToMe) {
      result = assignedToMe;
    } else if (isTeamFilterActive) {
      result = baseFiltered.filter(cluster =>
        cluster.assignedTo?.some(
          entity => entity.type === 'team' && selectedTeamIds.has(entity.id)
        )
      );
    }

    return result.sort((a, b) => (b.fixability_score ?? 0) - (a.fixability_score ?? 0));
  }, [
    customClusterData,
    topIssuesResponse?.data,
    isUsingCustomData,
    disableFilters,
    selection.projects,
    filterByAssignedToMe,
    user.id,
    userTeams,
    isTeamFilterActive,
    selectedTeamIds,
    dismissedClusterIds,
  ]);

  const hasMoreClusters = filteredAndSortedClusters.length > visibleClusterCount;
  const displayedClusters = hasMoreClusters
    ? filteredAndSortedClusters.slice(0, visibleClusterCount)
    : filteredAndSortedClusters;

  const totalIssues = filteredAndSortedClusters.flatMap(c => c.group_ids).length;
  const remainingClusterCount =
    filteredAndSortedClusters.length - displayedClusters.length;

  const handleShowMore = () => {
    setVisibleClusterCount(prev => prev + CLUSTERS_PER_PAGE);
  };

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  if (!hasTopIssuesUI) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <PageFiltersContainer>
      <PageWrapper>
        <HeaderSection>
          <Flex
            align="center"
            gap="md"
            justify="between"
            style={{marginBottom: space(2)}}
          >
            <Flex align="center" gap="md">
              <ClickableHeading as="h1" onClick={() => setShowDevTools(prev => !prev)}>
                {t('Top Issues (Experimental)')}
              </ClickableHeading>
              {isUsingCustomData && (
                <CustomDataBadge>
                  <Text size="xs" bold>
                    {t('Using Custom Data')}
                  </Text>
                  <Button
                    size="zero"
                    borderless
                    icon={<IconClose size="xs" />}
                    aria-label={t('Clear custom data')}
                    onClick={handleClearCustomData}
                  />
                </CustomDataBadge>
              )}
            </Flex>
            <Link to={`/organizations/${organization.slug}/issues/top-issues/`}>
              <Button size="sm">{t('View Single Card Layout')}</Button>
            </Link>
          </Flex>

          <Flex gap="sm" align="center" style={{marginBottom: space(2)}}>
            <ProjectPageFilter />
            {showDevTools && (
              <Button
                size="sm"
                icon={<IconUpload size="xs" />}
                onClick={() => setShowJsonInput(!showJsonInput)}
              >
                {showJsonInput ? t('Hide JSON Input') : t('Paste JSON')}
              </Button>
            )}
            <FeedbackButton
              size="sm"
              feedbackOptions={{
                messagePlaceholder: t('What do you think about the new Top Issues page?'),
                tags: {
                  ['feedback.source']: 'top-issues',
                  ['feedback.owner']: 'issues',
                },
              }}
            />
          </Flex>

          {showJsonInput && (
            <JsonInputContainer>
              <Text size="sm" variant="muted" style={{marginBottom: space(1)}}>
                {t(
                  'Paste cluster JSON data below. Accepts either a raw array of clusters or an object with a "data" property.'
                )}
              </Text>
              <TextArea
                value={jsonInputValue}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setJsonInputValue(e.target.value);
                  setJsonError(null);
                }}
                placeholder={t('Paste JSON here...')}
                rows={8}
                monospace
              />
              {jsonError && (
                <Text size="sm" style={{color: 'var(--red400)', marginTop: space(1)}}>
                  {jsonError}
                </Text>
              )}
              <Flex gap="sm" align="center" style={{marginTop: space(1.5)}}>
                <Checkbox
                  checked={disableFilters}
                  onChange={e => setDisableFilters(e.target.checked)}
                  aria-label={t('Disable filters and sorting')}
                  size="sm"
                />
                <Text size="sm" variant="muted">
                  {t('Disable filters and sorting')}
                </Text>
              </Flex>
              <Flex gap="sm" style={{marginTop: space(1)}}>
                <Button size="sm" priority="primary" onClick={handleParseJson}>
                  {t('Parse and Load')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowJsonInput(false);
                    setJsonError(null);
                  }}
                >
                  {t('Cancel')}
                </Button>
              </Flex>
            </JsonInputContainer>
          )}

          {isPending ? null : (
            <Fragment>
              <Flex justify="between" align="center">
                <Text size="sm" variant="muted">
                  {tn(
                    'Viewing %s cluster containing %s issue',
                    'Viewing %s clusters containing %s issues',
                    filteredAndSortedClusters.length,
                    totalIssues
                  )}
                  {isUsingCustomData && disableFilters && ` ${t('(filters disabled)')}`}
                </Text>
                {topIssuesResponse?.last_updated && (
                  <LastUpdatedText>
                    {t('Updated')}{' '}
                    <StyledTimeSince
                      date={topIssuesResponse.last_updated}
                      suffix={t('ago')}
                      unitStyle="short"
                    />
                  </LastUpdatedText>
                )}
              </Flex>

              {showDevTools && !(isUsingCustomData && disableFilters) && (
                <Container
                  padding="sm"
                  border="primary"
                  radius="md"
                  background="primary"
                  marginTop="md"
                >
                  <Disclosure>
                    <Disclosure.Title>
                      <Text size="sm" bold>
                        {t('More Filters')}
                      </Text>
                    </Disclosure.Title>
                    <Disclosure.Content>
                      <Flex direction="column" gap="md" paddingTop="md">
                        <Flex gap="sm" align="center">
                          <Checkbox
                            checked={filterByAssignedToMe}
                            onChange={e => handleAssignedToMeChange(e.target.checked)}
                            aria-label={t('Show only issues assigned to me')}
                            size="sm"
                            disabled={isTeamFilterActive}
                          />
                          <FilterLabel disabled={isTeamFilterActive}>
                            {t('Only show issues assigned to me')}
                          </FilterLabel>
                        </Flex>

                        {teamsInData.length > 0 && (
                          <Flex direction="column" gap="sm">
                            <FilterLabel disabled={filterByAssignedToMe}>
                              {t('Filter by teams')}
                            </FilterLabel>
                            <Flex direction="column" gap="xs" style={{paddingLeft: 8}}>
                              {teamsInData.map(team => (
                                <Flex key={team.id} gap="sm" align="center">
                                  <Checkbox
                                    checked={selectedTeamIds.has(team.id)}
                                    onChange={() => handleTeamToggle(team.id)}
                                    aria-label={t('Filter by team %s', team.name)}
                                    size="sm"
                                    disabled={filterByAssignedToMe}
                                  />
                                  <FilterLabel disabled={filterByAssignedToMe}>
                                    #{team.name}
                                  </FilterLabel>
                                </Flex>
                              ))}
                            </Flex>
                          </Flex>
                        )}

                        <Flex direction="column" gap="sm">
                          <FilterLabel>{t('Filter by status')}</FilterLabel>
                          <Flex direction="column" gap="xs" style={{paddingLeft: 8}}>
                            <Flex gap="sm" align="center">
                              <Checkbox
                                checked={filterByRegressed}
                                onChange={e => setFilterByRegressed(e.target.checked)}
                                aria-label={t('Show only clusters with regressed issues')}
                                size="sm"
                              />
                              <FilterLabel>{t('Has regressed issues')}</FilterLabel>
                            </Flex>
                            <Flex gap="sm" align="center">
                              <Checkbox
                                checked={filterByEscalating}
                                onChange={e => setFilterByEscalating(e.target.checked)}
                                aria-label={t('Show only escalating clusters')}
                                size="sm"
                              />
                              <FilterLabel>{t('Escalating (>1.5x events)')}</FilterLabel>
                            </Flex>
                          </Flex>
                        </Flex>
                      </Flex>
                    </Disclosure.Content>
                  </Disclosure>
                </Container>
              )}
            </Fragment>
          )}
        </HeaderSection>

        <CardsSection>
          {isPending ? (
            <LoadingIndicator />
          ) : displayedClusters.length === 0 ? (
            <Container padding="lg" border="primary" radius="md" background="primary">
              <Text variant="muted" align="center" as="div">
                {t('No clusters match the current filters')}
              </Text>
            </Container>
          ) : (
            <CardsGrid>
              <CardsColumn>
                {displayedClusters
                  .filter((_, index) => index % 2 === 0)
                  .map(cluster => (
                    <ClusterCard
                      key={cluster.cluster_id}
                      cluster={cluster}
                      filterByRegressed={filterByRegressed}
                      filterByEscalating={filterByEscalating}
                      onDismiss={handleDismissCluster}
                    />
                  ))}
              </CardsColumn>
              <CardsColumn>
                {displayedClusters
                  .filter((_, index) => index % 2 === 1)
                  .map(cluster => (
                    <ClusterCard
                      key={cluster.cluster_id}
                      cluster={cluster}
                      filterByRegressed={filterByRegressed}
                      filterByEscalating={filterByEscalating}
                      onDismiss={handleDismissCluster}
                    />
                  ))}
              </CardsColumn>
            </CardsGrid>
          )}
          {hasMoreClusters && (
            <ShowMoreButton onClick={handleShowMore}>
              {t('Show more clusters (%s more)', remainingClusterCount)}
            </ShowMoreButton>
          )}
        </CardsSection>
      </PageWrapper>
    </PageFiltersContainer>
  );
}

const PageWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`;

const HeaderSection = styled('div')`
  padding: ${space(4)} ${space(4)} ${space(3)};
  background: ${p => p.theme.backgroundSecondary};
`;

const ClickableHeading = styled(Heading)`
  cursor: pointer;
  user-select: none;
`;

const CardsSection = styled('div')`
  flex: 1;
  padding: ${space(2)} ${space(4)} ${space(4)};
  background: ${p => p.theme.backgroundSecondary};
`;

const CardsGrid = styled('div')`
  display: flex;
  gap: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    flex-direction: column;
  }
`;

const CardsColumn = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  min-width: 0;
`;

const CardContainer = styled('div')`
  position: relative;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.colors.blue200};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
`;

const CardHeader = styled('div')`
  padding: ${space(3)} ${space(3)} ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ClusterTitleLink = styled(Link)`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: 600;
  color: ${p => p.theme.tokens.content.primary};
  line-height: 1.3;
  word-break: break-word;
  text-decoration: none;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }
`;

const StatsRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(2)};
`;

const ClusterStats = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(2)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const TimeStats = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const StatItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ProjectAvatars = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const MoreProjectsCount = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${space(0.25)};
`;

const ClusterStatusTags = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const StatusTag = styled('div')<{color: 'purple' | 'yellow' | 'red'}>`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: ${p => p.theme.radius.md};
  font-size: ${p => p.theme.fontSize.xs};

  ${p => {
    switch (p.color) {
      case 'purple':
        return `
          background: ${p.theme.colors.blue100};
          color: ${p.theme.colors.blue400};
        `;
      case 'yellow':
        return `
          background: ${p.theme.colors.yellow100};
          color: ${p.theme.colors.yellow400};
        `;
      case 'red':
        return `
          background: ${p.theme.colors.red100};
          color: ${p.theme.colors.red400};
        `;
      default:
        return '';
    }
  }}
`;

const TabSection = styled('div')`
  position: relative;
  z-index: 1;
`;

const TabBar = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  padding: ${space(1)} ${space(3)} 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const Tab = styled('button')<{isActive: boolean}>`
  background: none;
  border: none;
  padding: ${space(1)} ${space(1.5)};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 500;
  color: ${p =>
    p.isActive ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};
  cursor: pointer;
  position: relative;
  margin-bottom: -1px;

  ${p =>
    p.isActive &&
    `
    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: ${p.theme.colors.blue400};
    }
  `}

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const TabContent = styled('div')`
  padding: ${space(2)} ${space(3)};
`;

const CardFooter = styled('div')`
  position: relative;
  z-index: 1;
  padding: ${space(2)} ${space(3)};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
`;

const FooterActions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SeerButton = styled(Button)`
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
`;

const SeerDropdownTrigger = styled(Button)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
`;

const IssuePreviewLink = styled(Link)`
  display: block;
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: ${p => p.theme.colors.blue400};
    background: ${p => p.theme.tokens.background.primary};
  }
`;

const IssueTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.tokens.content.primary};
  line-height: 1.4;
  ${p => p.theme.overflowEllipsis};

  em {
    font-size: ${p => p.theme.fontSize.sm};
    font-style: normal;
    font-weight: ${p => p.theme.fontWeight.normal};
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const IssueMessage = styled(EventMessage)`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  opacity: 0.9;
`;

const MetaSeparator = styled('div')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.tokens.border.secondary};
`;

const DescriptionText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  line-height: 1.5;
`;

const StructuredInfo = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const TagsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
`;

const TagPill = styled('span')`
  display: inline-block;
  padding: ${space(0.25)} ${space(1)};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.secondary};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const InfoRow = styled('div')`
  display: flex;
  align-items: baseline;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.sm};
`;

const InfoLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: 500;
  min-width: 60px;
  flex-shrink: 0;
`;

const InfoValue = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  word-break: break-word;
`;

const FilterLabel = styled('span')<{disabled?: boolean}>`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => (p.disabled ? p.theme.tokens.content.disabled : p.theme.tokens.content.secondary)};
`;

const ShowMoreButton = styled('button')`
  display: block;
  width: 100%;
  margin-top: ${space(3)};
  padding: ${space(2)} ${space(3)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.md};
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: ${p => p.theme.backgroundTertiary};
    border-color: ${p => p.theme.colors.blue400};
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const JsonInputContainer = styled('div')`
  margin-bottom: ${space(2)};
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const CustomDataBadge = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.colors.yellow100};
  border: 1px solid ${p => p.theme.colors.yellow400};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.colors.yellow500};
`;

const LastUpdatedText = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;

const StyledTimeSince = styled(TimeSince)`
  color: inherit;
  text-decoration: none;

  &:hover {
    text-decoration: none;
  }
`;

export default DynamicGrouping;
