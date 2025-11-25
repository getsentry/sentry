import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Disclosure} from 'sentry/components/core/disclosure';
import {NumberInput} from 'sentry/components/core/input/numberInput';
import {Link} from 'sentry/components/core/link';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import TimesTag from 'sentry/components/group/inboxBadges/timesTag';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconClock, IconFire, IconFix} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

interface AssignedEntity {
  email: string | null;
  id: string;
  name: string;
  type: string;
}

interface ClusterSummary {
  assignedTo: AssignedEntity[];
  cluster_avg_similarity: number | null; // unused
  cluster_id: number;
  cluster_min_similarity: number | null; // unused
  cluster_size: number | null; // unused
  description: string;
  fixability_score: number | null;
  group_ids: number[];
  issue_titles: string[]; // unused
  project_ids: number[]; // unused
  tags: string[]; // unused
  title: string;
}

interface TopIssuesResponse {
  data: ClusterSummary[];
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
  isPending: boolean;
  lastSeen: string | null;
  totalEvents: number;
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
        firstSeen: null,
        lastSeen: null,
        isPending,
      };
    }

    let totalEvents = 0;
    let earliestFirstSeen: Date | null = null;
    let latestLastSeen: Date | null = null;

    for (const group of groups) {
      totalEvents += parseInt(group.count, 10) || 0;

      if (group.firstSeen) {
        const firstSeenDate = new Date(group.firstSeen);
        if (!earliestFirstSeen || firstSeenDate < earliestFirstSeen) {
          earliestFirstSeen = firstSeenDate;
        }
      }

      if (group.lastSeen) {
        const lastSeenDate = new Date(group.lastSeen);
        if (!latestLastSeen || lastSeenDate > latestLastSeen) {
          latestLastSeen = lastSeenDate;
        }
      }
    }

    return {
      totalEvents,
      firstSeen: earliestFirstSeen?.toISOString() ?? null,
      lastSeen: latestLastSeen?.toISOString() ?? null,
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

function ClusterCard({
  cluster,
  onRemove,
}: {
  cluster: ClusterSummary;
  onRemove: (clusterId: number) => void;
}) {
  const organization = useOrganization();
  const issueCount = cluster.group_ids.length;
  const [showDescription, setShowDescription] = useState(false);
  const clusterStats = useClusterStats(cluster.group_ids);

  return (
    <CardContainer>
      <Flex justify="between" align="start" gap="md">
        <Flex direction="column" gap="xs" style={{flex: 1, minWidth: 0}}>
          <Heading as="h3" size="md" style={{wordBreak: 'break-word'}}>
            {cluster.title}
          </Heading>
          {cluster.description && (
            <Fragment>
              {showDescription ? (
                <DescriptionText>{cluster.description}</DescriptionText>
              ) : (
                <ReadMoreButton onClick={() => setShowDescription(true)}>
                  {t('View summary')}
                </ReadMoreButton>
              )}
            </Fragment>
          )}
        </Flex>
        <IssueCountBadge>
          <IssueCountNumber>{issueCount}</IssueCountNumber>
          <Text size="xs" variant="muted" uppercase>
            {tn('issue', 'issues', issueCount)}
          </Text>
        </IssueCountBadge>
      </Flex>

      <ClusterStatsBar>
        {cluster.fixability_score && (
          <StatItem>
            <IconFix size="xs" color="gray300" style={{marginTop: 1}} />
            <Text size="xs">
              <Text size="xs" bold as="span">
                {Math.round(cluster.fixability_score * 100)}%
              </Text>{' '}
              {t('confidence')}
            </Text>
          </StatItem>
        )}
        <StatItem>
          <IconFire size="xs" color="gray300" />
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
        {!clusterStats.isPending && clusterStats.lastSeen && (
          <StatItem>
            <IconClock size="xs" color="gray300" />
            <TimeSince
              tooltipPrefix={t('Last Seen')}
              date={clusterStats.lastSeen}
              suffix={t('ago')}
              unitStyle="short"
            />
          </StatItem>
        )}
        {!clusterStats.isPending && clusterStats.firstSeen && (
          <StatItem>
            <IconCalendar size="xs" color="gray300" />
            <TimeSince
              tooltipPrefix={t('First Seen')}
              date={clusterStats.firstSeen}
              suffix={t('old')}
              unitStyle="short"
            />
          </StatItem>
        )}
      </ClusterStatsBar>

      <Flex direction="column" flex="1" paddingTop="md">
        <ClusterIssues groupIds={cluster.group_ids} />

        {cluster.group_ids.length > 3 && (
          <Text
            size="sm"
            variant="muted"
            align="center"
            style={{marginTop: space(1), fontStyle: 'italic'}}
          >
            {t('+ %s more similar issues', cluster.group_ids.length - 3)}
          </Text>
        )}
      </Flex>

      <Flex justify="end" align="center" gap="xs" paddingTop="md">
        <Button size="sm" priority="primary" onClick={() => onRemove(cluster.cluster_id)}>
          {t('Resolve')}
        </Button>
        <Link
          to={`/organizations/${organization.slug}/issues/?query=issue.id:[${cluster.group_ids.join(',')}]`}
        >
          <Button size="sm">{t('View All Issues')}</Button>
        </Link>
      </Flex>
    </CardContainer>
  );
}

function DynamicGrouping() {
  const organization = useOrganization();
  const user = useUser();
  const {teams: userTeams} = useUserTeams();
  const [filterByAssignedToMe, setFilterByAssignedToMe] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [minFixabilityScore, setMinFixabilityScore] = useState(50);
  const [removedClusterIds, setRemovedClusterIds] = useState<Set<number>>(new Set());

  // Fetch cluster data from API
  const {data: topIssuesResponse, isPending} = useApiQuery<TopIssuesResponse>(
    [`/organizations/${organization.slug}/top-issues/`],
    {
      staleTime: 60000,
    }
  );

  const clusterData = topIssuesResponse?.data ?? [];

  // Extract all unique teams from the cluster data
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

  const handleRemoveCluster = (clusterId: number) => {
    setRemovedClusterIds(prev => new Set([...prev, clusterId]));
  };

  const filteredAndSortedClusters = clusterData
    .filter(cluster => {
      if (removedClusterIds.has(cluster.cluster_id)) return false;

      const fixabilityScore = (cluster.fixability_score ?? 0) * 100;
      if (fixabilityScore < minFixabilityScore) return false;

      if (filterByAssignedToMe) {
        if (!cluster.assignedTo?.length) return false;
        return cluster.assignedTo.some(
          entity =>
            (entity.type === 'user' && entity.id === user.id) ||
            (entity.type === 'team' && userTeams.some(team => team.id === entity.id))
        );
      }

      if (isTeamFilterActive) {
        if (!cluster.assignedTo?.length) return false;
        return cluster.assignedTo.some(
          entity => entity.type === 'team' && selectedTeamIds.has(entity.id)
        );
      }

      return true;
    })
    .sort((a, b) => (b.fixability_score ?? 0) - (a.fixability_score ?? 0));

  const totalIssues = filteredAndSortedClusters.flatMap(c => c.group_ids).length;

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  if (!hasTopIssuesUI) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <PageWrapper>
      <HeaderSection>
        <Breadcrumbs
          crumbs={[
            {
              label: t('Issues'),
              to: `/organizations/${organization.slug}/issues/`,
            },
            {
              label: t('Top Issues'),
            },
          ]}
        />

        <Heading as="h1" style={{marginBottom: space(2)}}>
          {t('Top Issues')}
        </Heading>

        {isPending ? null : (
          <Fragment>
            <Text size="sm" variant="muted">
              {tn(
                'Viewing %s issue in %s cluster',
                'Viewing %s issues across %s clusters',
                totalIssues,
                filteredAndSortedClusters.length
              )}
            </Text>

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

                    <Flex gap="sm" align="center">
                      <Text size="sm" variant="muted">
                        {t('Minimum fixability score (%)')}
                      </Text>
                      <NumberInput
                        min={0}
                        max={100}
                        value={minFixabilityScore}
                        onChange={value => setMinFixabilityScore(value ?? 0)}
                        aria-label={t('Minimum fixability score')}
                        size="sm"
                      />
                    </Flex>
                  </Flex>
                </Disclosure.Content>
              </Disclosure>
            </Container>
          </Fragment>
        )}
      </HeaderSection>

      <CardsSection>
        {isPending ? (
          <LoadingIndicator />
        ) : filteredAndSortedClusters.length === 0 ? (
          <Container padding="lg" border="primary" radius="md" background="primary">
            <Text variant="muted" align="center" as="div">
              {t('No clusters match the current filters')}
            </Text>
          </Container>
        ) : (
          <CardsGrid>
            {filteredAndSortedClusters.map(cluster => (
              <ClusterCard
                key={cluster.cluster_id}
                cluster={cluster}
                onRemove={handleRemoveCluster}
              />
            ))}
          </CardsGrid>
        )}
      </CardsSection>
    </PageWrapper>
  );
}

const PageWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`;

const HeaderSection = styled('div')`
  padding: ${space(4)} ${space(4)} ${space(3)};
`;

const CardsSection = styled('div')`
  flex: 1;
  padding: ${space(2)} ${space(4)} ${space(4)};
`;

const CardsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${space(3)};
  align-items: start;

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
  }
`;

// Card with hover effect
const CardContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

// Issue count badge - compact version
const IssueCountBadge = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  flex-shrink: 0;
`;

const IssueCountNumber = styled('div')`
  font-size: 24px;
  font-weight: 600;
  color: ${p => p.theme.purple400};
  line-height: 1;
`;

// Horizontal stats bar below header
const ClusterStatsBar = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(2)};
  padding: ${space(1.5)} 0;
  margin-top: ${space(1.5)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const StatItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

// Issue preview link with hover effect
const IssuePreviewLink = styled(Link)`
  display: block;
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    background: ${p => p.theme.backgroundElevated};
  }
`;

// Issue title with ellipsis and nested em styling for EventOrGroupTitle
const IssueTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
  line-height: 1.4;
  ${p => p.theme.overflowEllipsis};

  em {
    font-size: ${p => p.theme.fontSize.sm};
    font-style: normal;
    font-weight: ${p => p.theme.fontWeight.normal};
    color: ${p => p.theme.subText};
  }
`;

// EventMessage override for compact display
const IssueMessage = styled(EventMessage)`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

// Meta separator line
const MetaSeparator = styled('div')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.innerBorder};
`;

const ReadMoreButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  cursor: pointer;
  text-align: left;

  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
  }
`;

const DescriptionText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const FilterLabel = styled('span')<{disabled?: boolean}>`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.subText)};
`;

export default DynamicGrouping;
