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
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQueries, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

interface AssignedEntity {
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
  tags: string[];
  title: string;
}

interface TopIssuesResponse {
  data: ClusterSummary[];
}

const EMPTY_CLUSTERS: ClusterSummary[] = [];

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
  lastSeen: string | null;
  totalEvents: number;
}

const BATCH_SIZE = 50;

/** Fetches issue stats for clusters in batches to avoid API limits. */
function useBatchClusterStats(clusters: ClusterSummary[]): {
  isPending: boolean;
  statsMap: Map<number, ClusterStats>;
} {
  const organization = useOrganization();

  const {groupToClusterMap, allGroupIds} = useMemo(() => {
    const map = new Map<number, number>();
    for (const cluster of clusters) {
      for (const groupId of cluster.group_ids) {
        map.set(groupId, cluster.cluster_id);
      }
    }
    return {groupToClusterMap: map, allGroupIds: Array.from(map.keys())};
  }, [clusters]);

  const batchedQueryKeys = useMemo(() => {
    const batches: ApiQueryKey[] = [];
    for (let i = 0; i < allGroupIds.length; i += BATCH_SIZE) {
      const batch = allGroupIds.slice(i, i + BATCH_SIZE);
      batches.push([
        `/organizations/${organization.slug}/issues/`,
        {query: {group: batch, query: `issue.id:[${batch.join(',')}]`}},
      ]);
    }
    return batches;
  }, [allGroupIds, organization.slug]);

  const queryResults = useApiQueries<Group[]>(batchedQueryKeys, {
    staleTime: 60000,
    enabled: allGroupIds.length > 0,
  });

  return useMemo(() => {
    const isPending = queryResults.some(r => r.isPending);
    if (isPending || allGroupIds.length === 0) {
      return {statsMap: new Map(), isPending};
    }

    const statsMap = new Map<number, ClusterStats>(
      clusters.map(c => [c.cluster_id, {totalEvents: 0, firstSeen: null, lastSeen: null}])
    );

    for (const group of queryResults.flatMap(r => r.data ?? [])) {
      const clusterId = groupToClusterMap.get(Number(group.id));
      if (clusterId === undefined) continue;
      const stats = statsMap.get(clusterId);
      if (!stats) continue;

      stats.totalEvents += Number(group.count) || 0;
      if (group.firstSeen && (!stats.firstSeen || group.firstSeen < stats.firstSeen)) {
        stats.firstSeen = group.firstSeen;
      }
      if (group.lastSeen && (!stats.lastSeen || group.lastSeen > stats.lastSeen)) {
        stats.lastSeen = group.lastSeen;
      }
    }

    return {statsMap, isPending: false};
  }, [queryResults, clusters, groupToClusterMap, allGroupIds.length]);
}

interface ScoreWeights {
  events: number;
  fixability: number;
  issues: number;
  recency: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  events: 25,
  fixability: 75,
  issues: 25,
  recency: 25,
};

/** Min-max normalization to [0, 1]. Returns 0.5 if max === min. */
function normalize(value: number, min: number, max: number) {
  return max === min ? 0.5 : (value - min) / (max - min);
}

interface FilterOptions {
  filterByAssignedToMe: boolean;
  minFixabilityScore: number;
  removedClusterIds: Set<number>;
  selectedTeamIds: Set<string>;
  userId: string;
  userTeamIds: Set<string>;
}

function filterClusters(
  clusters: ClusterSummary[],
  options: FilterOptions
): ClusterSummary[] {
  const {
    removedClusterIds,
    minFixabilityScore,
    filterByAssignedToMe,
    selectedTeamIds,
    userId,
    userTeamIds,
  } = options;

  return clusters.filter(cluster => {
    if (removedClusterIds.has(cluster.cluster_id)) return false;
    if ((cluster.fixability_score ?? 0) * 100 < minFixabilityScore) return false;

    if (filterByAssignedToMe) {
      return cluster.assignedTo?.some(
        e =>
          (e.type === 'user' && e.id === userId) ||
          (e.type === 'team' && userTeamIds.has(e.id))
      );
    }
    if (selectedTeamIds.size > 0) {
      return cluster.assignedTo?.some(
        e => e.type === 'team' && selectedTeamIds.has(e.id)
      );
    }
    return true;
  });
}

function sortClustersByScore(
  clusters: ClusterSummary[],
  statsMap: Map<number, ClusterStats>,
  weights: ScoreWeights
): ClusterSummary[] {
  if (clusters.length === 0) {
    return clusters;
  }

  const now = Date.now();

  // Compute min/max ranges for normalization
  let minFix = Infinity,
    maxFix = -Infinity;
  let minEvents = Infinity,
    maxEvents = -Infinity;
  let minRecency = Infinity,
    maxRecency = -Infinity;
  let minIssues = Infinity,
    maxIssues = -Infinity;

  for (const cluster of clusters) {
    const stats = statsMap.get(cluster.cluster_id);
    const fixability = cluster.fixability_score ?? 0;
    const events = stats?.totalEvents ?? 0;
    const issues = cluster.group_ids.length;

    minFix = Math.min(minFix, fixability);
    maxFix = Math.max(maxFix, fixability);
    minEvents = Math.min(minEvents, events);
    maxEvents = Math.max(maxEvents, events);
    minIssues = Math.min(minIssues, issues);
    maxIssues = Math.max(maxIssues, issues);

    if (stats?.lastSeen) {
      const age = now - new Date(stats.lastSeen).getTime();
      minRecency = Math.min(minRecency, age);
      maxRecency = Math.max(maxRecency, age);
    }
  }

  const total = weights.fixability + weights.events + weights.recency + weights.issues;
  const getWeight = (key: keyof ScoreWeights) =>
    total > 0 ? weights[key] / total : 0.25;

  const scores = new Map<number, number>();
  for (const cluster of clusters) {
    const stats = statsMap.get(cluster.cluster_id);
    const recency =
      stats?.lastSeen && minRecency !== Infinity
        ? 1 - normalize(now - new Date(stats.lastSeen).getTime(), minRecency, maxRecency)
        : 0.5;

    const score =
      getWeight('fixability') * normalize(cluster.fixability_score ?? 0, minFix, maxFix) +
      getWeight('events') * normalize(stats?.totalEvents ?? 0, minEvents, maxEvents) +
      getWeight('recency') * recency +
      getWeight('issues') * normalize(cluster.group_ids.length, minIssues, maxIssues);

    scores.set(cluster.cluster_id, score);
  }

  return clusters.toSorted(
    (a, b) => (scores.get(b.cluster_id) ?? 0) - (scores.get(a.cluster_id) ?? 0)
  );
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
  clusterStats,
  onRemove,
}: {
  cluster: ClusterSummary;
  clusterStats: ClusterStats;
  onRemove: (clusterId: number) => void;
}) {
  const organization = useOrganization();
  const issueCount = cluster.group_ids.length;
  const [showDescription, setShowDescription] = useState(false);

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
          <Text size="xs">
            <Text size="xs" bold as="span">
              {clusterStats.totalEvents.toLocaleString()}
            </Text>{' '}
            {tn('event', 'events', clusterStats.totalEvents)}
          </Text>
        </StatItem>
        {clusterStats.lastSeen && (
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
        {clusterStats.firstSeen && (
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
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set<string>());
  const [minFixabilityScore, setMinFixabilityScore] = useState(50);
  const [removedClusterIds, setRemovedClusterIds] = useState(new Set<number>());
  const [scoreWeights, setScoreWeights] = useState(DEFAULT_WEIGHTS);

  const {data: topIssuesResponse, isPending: isClustersPending} =
    useApiQuery<TopIssuesResponse>([`/organizations/${organization.slug}/top-issues/`], {
      staleTime: 60000,
    });

  const clusterData = topIssuesResponse?.data ?? EMPTY_CLUSTERS;
  const {statsMap, isPending: isStatsPending} = useBatchClusterStats(clusterData);
  const isPending = isClustersPending || isStatsPending;

  const teamMap = new Map<string, {id: string; name: string}>();
  for (const cluster of clusterData) {
    for (const entity of cluster.assignedTo ?? []) {
      if (entity.type === 'team' && !teamMap.has(entity.id)) {
        teamMap.set(entity.id, {id: entity.id, name: entity.name});
      }
    }
  }
  const teamsInData = Array.from(teamMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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

  const userTeamIds = useMemo(() => new Set(userTeams.map(team => team.id)), [userTeams]);

  const filteredClusters = useMemo(
    () =>
      filterClusters(clusterData, {
        removedClusterIds,
        minFixabilityScore,
        filterByAssignedToMe,
        selectedTeamIds,
        userId: user.id,
        userTeamIds,
      }),
    [
      clusterData,
      removedClusterIds,
      minFixabilityScore,
      filterByAssignedToMe,
      selectedTeamIds,
      user.id,
      userTeamIds,
    ]
  );

  const sortedClusters = useMemo(
    () => sortClustersByScore(filteredClusters, statsMap, scoreWeights),
    [filteredClusters, statsMap, scoreWeights]
  );

  const totalIssues = sortedClusters.reduce((sum, c) => sum + c.group_ids.length, 0);

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
                sortedClusters.length
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
                    <Flex direction="column" gap="sm">
                      <Text size="sm" bold>
                        {t('Sorting Weights')}
                      </Text>
                      <Text size="xs" variant="muted">
                        {t(
                          'Adjust how much each signal contributes to the priority score. Weights are normalized automatically.'
                        )}
                      </Text>

                      <WeightInputRow>
                        <WeightLabel>{t('Fixability')}</WeightLabel>
                        <NumberInput
                          min={0}
                          max={100}
                          value={scoreWeights.fixability}
                          onChange={value =>
                            setScoreWeights(prev => ({...prev, fixability: value ?? 0}))
                          }
                          aria-label={t('Fixability weight')}
                          size="sm"
                        />
                      </WeightInputRow>

                      <WeightInputRow>
                        <WeightLabel>{t('Event Count')}</WeightLabel>
                        <NumberInput
                          min={0}
                          max={100}
                          value={scoreWeights.events}
                          onChange={value =>
                            setScoreWeights(prev => ({...prev, events: value ?? 0}))
                          }
                          aria-label={t('Event count weight')}
                          size="sm"
                        />
                      </WeightInputRow>

                      <WeightInputRow>
                        <WeightLabel>{t('Recency')}</WeightLabel>
                        <NumberInput
                          min={0}
                          max={100}
                          value={scoreWeights.recency}
                          onChange={value =>
                            setScoreWeights(prev => ({...prev, recency: value ?? 0}))
                          }
                          aria-label={t('Recency weight')}
                          size="sm"
                        />
                      </WeightInputRow>

                      <WeightInputRow>
                        <WeightLabel>{t('Issue Count')}</WeightLabel>
                        <NumberInput
                          min={0}
                          max={100}
                          value={scoreWeights.issues}
                          onChange={value =>
                            setScoreWeights(prev => ({...prev, issues: value ?? 0}))
                          }
                          aria-label={t('Issue count weight')}
                          size="sm"
                        />
                      </WeightInputRow>
                    </Flex>

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
        ) : sortedClusters.length === 0 ? (
          <Container padding="lg" border="primary" radius="md" background="primary">
            <Text variant="muted" align="center" as="div">
              {t('No clusters match the current filters')}
            </Text>
          </Container>
        ) : (
          <CardsGrid>
            {sortedClusters.map(cluster => (
              <ClusterCard
                key={cluster.cluster_id}
                cluster={cluster}
                clusterStats={
                  statsMap.get(cluster.cluster_id) ?? {
                    totalEvents: 0,
                    firstSeen: null,
                    lastSeen: null,
                  }
                }
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

// EventOrGroupTitle renders emphasized text in <em> tags
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

const IssueMessage = styled(EventMessage)`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

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

const WeightInputRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const WeightLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  min-width: 90px;
`;

export default DynamicGrouping;
