import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {InlineCode} from 'sentry/components/core/code/inlineCode';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Redirect from 'sentry/components/redirect';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconClock, IconFire, IconLink, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
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

interface TopIssuesResponse {
  data: ClusterSummary[];
  last_updated?: string;
}

interface ClusterStats {
  firstSeen: string | null;
  isPending: boolean;
  lastSeen: string | null;
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
        isPending,
      };
    }

    let totalEvents = 0;
    let totalUsers = 0;
    let earliestFirstSeen: Date | null = null;
    let latestLastSeen: Date | null = null;

    for (const group of groups) {
      totalEvents += parseInt(group.count, 10) || 0;
      totalUsers += group.userCount || 0;

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
      totalUsers,
      firstSeen: earliestFirstSeen?.toISOString() ?? null,
      lastSeen: latestLastSeen?.toISOString() ?? null,
      isPending,
    };
  }, [groups, isPending]);
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

function ClusterDetailCard({cluster}: {cluster: ClusterSummary}) {
  const organization = useOrganization();
  const clusterStats = useClusterStats(cluster.group_ids);

  const allTags = [
    ...new Set([
      ...(cluster.error_type_tags ?? []),
      ...(cluster.code_area_tags ?? []),
      ...(cluster.service_tags ?? []),
    ]),
  ];

  const assignedUsers = cluster.assignedTo?.filter(e => e.type === 'user') ?? [];
  const assignedTeams = cluster.assignedTo?.filter(e => e.type === 'team') ?? [];
  const totalAssigned = assignedUsers.length + assignedTeams.length;

  const relevancePercent = cluster.fixability_score
    ? Math.round(cluster.fixability_score * 100)
    : null;

  return (
    <CardContainer>
      <CardMain>
        <CardHeader>
          <Heading as="h2" size="xl" style={{marginBottom: space(2)}}>
            {renderWithInlineCode(cluster.title)}
          </Heading>
          <Flex wrap="wrap" align="center" gap="md" style={{marginBottom: space(2)}}>
            {relevancePercent !== null && (
              <Flex align="center" gap="xs">
                <IconLink size="xs" />
                <Text size="sm">
                  <Text size="sm" bold as="span">
                    {relevancePercent}%
                  </Text>{' '}
                  {t('relevance')}
                </Text>
              </Flex>
            )}
            <Flex align="center" gap="xs">
              <IconUser size="xs" />
              {clusterStats.isPending ? (
                <Text size="sm" variant="muted">
                  –
                </Text>
              ) : (
                <Text size="sm">
                  <Text size="sm" bold as="span">
                    {clusterStats.totalUsers.toLocaleString()}
                  </Text>{' '}
                  {tn('user', 'users', clusterStats.totalUsers)}
                </Text>
              )}
            </Flex>
            <Flex align="center" gap="xs">
              <IconFire size="xs" />
              {clusterStats.isPending ? (
                <Text size="sm" variant="muted">
                  –
                </Text>
              ) : (
                <Text size="sm">
                  <Text size="sm" bold as="span">
                    {clusterStats.totalEvents.toLocaleString()}
                  </Text>{' '}
                  {tn('event', 'events', clusterStats.totalEvents)}
                </Text>
              )}
            </Flex>
            {!clusterStats.isPending && clusterStats.lastSeen && (
              <Flex align="center" gap="xs">
                <IconClock size="xs" />
                <TimeSince
                  date={clusterStats.lastSeen}
                  suffix={t('ago')}
                  unitStyle="short"
                />
              </Flex>
            )}
            {!clusterStats.isPending && clusterStats.firstSeen && (
              <Flex align="center" gap="xs">
                <IconCalendar size="xs" />
                <TimeSince
                  date={clusterStats.firstSeen}
                  suffix={t('old')}
                  unitStyle="short"
                />
              </Flex>
            )}
          </Flex>

          <Flex wrap="wrap" gap="lg" style={{marginBottom: space(2)}}>
            {cluster.error_type && (
              <Flex gap="xs">
                <Text size="sm" variant="muted">
                  {t('Error')}
                </Text>
                <Text size="sm">{cluster.error_type}</Text>
              </Flex>
            )}
            {cluster.location && (
              <Flex gap="xs">
                <Text size="sm" variant="muted">
                  {t('Location')}
                </Text>
                <Text size="sm">{cluster.location}</Text>
              </Flex>
            )}
          </Flex>

          {allTags.length > 0 && (
            <Flex wrap="wrap" gap="xs">
              {allTags.slice(0, 8).map(tag => (
                <TagPill key={tag}>{tag}</TagPill>
              ))}
              {allTags.length > 8 && <TagPill>+{allTags.length - 8}</TagPill>}
            </Flex>
          )}
        </CardHeader>

        <ContentSection>
          <Heading as="h3" size="md" style={{marginBottom: space(1.5)}}>
            {t('What went wrong')}
          </Heading>
          <div style={{minHeight: 60}}>
            {cluster.summary ? (
              <Text size="sm">{renderWithInlineCode(cluster.summary)}</Text>
            ) : (
              <Text size="sm" variant="muted">
                {t('No summary available')}
              </Text>
            )}
          </div>
        </ContentSection>

        <CardFooter>
          <Link
            to={`/organizations/${organization.slug}/issues/?query=issue.id:[${cluster.group_ids.join(',')}]`}
          >
            <Button size="sm">
              {t('View All Issues')} ({cluster.group_ids.length})
            </Button>
          </Link>
        </CardFooter>
      </CardMain>

      <CardSidebar>
        <Heading as="h4" size="md" style={{marginBottom: space(1.5)}}>
          {t('People')}
        </Heading>
        {totalAssigned > 0 ? (
          <Tooltip
            title={
              <Flex direction="column" gap="xs">
                {assignedUsers.map(user => (
                  <Text key={user.id} size="xs">
                    {user.name || user.email}
                  </Text>
                ))}
                {assignedTeams.map(team => (
                  <Text key={team.id} size="xs">
                    #{team.name}
                  </Text>
                ))}
              </Flex>
            }
          >
            <Flex align="center" gap="sm">
              <AvatarStack>
                {cluster.assignedTo.slice(0, 3).map((entity, i) => (
                  <AvatarPlaceholder key={entity.id} style={{zIndex: 3 - i}}>
                    {entity.name?.charAt(0).toUpperCase() || '?'}
                  </AvatarPlaceholder>
                ))}
              </AvatarStack>
              <Text size="sm" variant="muted">
                {tn('%s assignee', '%s assignees', totalAssigned)}
              </Text>
            </Flex>
          </Tooltip>
        ) : (
          <Text size="sm" variant="muted">
            {t('No assignees')}
          </Text>
        )}
      </CardSidebar>
    </CardContainer>
  );
}

function TopIssues() {
  const organization = useOrganization();
  const user = useUser();
  const {teams: userTeams} = useUserTeams();
  const {selection} = usePageFilters();
  const [filterByAssignedToMe, setFilterByAssignedToMe] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const {data: topIssuesResponse, isPending} = useApiQuery<TopIssuesResponse>(
    [`/organizations/${organization.slug}/top-issues/`],
    {
      staleTime: 60000,
    }
  );

  const filteredClusters = useMemo(() => {
    const clusterData = topIssuesResponse?.data ?? [];

    let filtered = clusterData.filter(cluster => {
      if (!cluster.error_type || !cluster.impact || !cluster.location) {
        return false;
      }

      if (selection.projects.length > 0 && !selection.projects.includes(-1)) {
        if (!cluster.project_ids.some(pid => selection.projects.includes(pid))) {
          return false;
        }
      }

      return true;
    });

    if (filterByAssignedToMe) {
      filtered = filtered.filter(cluster =>
        cluster.assignedTo?.some(
          entity =>
            (entity.type === 'user' && entity.id === user.id) ||
            (entity.type === 'team' && userTeams.some(team => team.id === entity.id))
        )
      );
    }

    return filtered.sort((a, b) => (b.fixability_score ?? 0) - (a.fixability_score ?? 0));
  }, [
    topIssuesResponse?.data,
    selection.projects,
    filterByAssignedToMe,
    user.id,
    userTeams,
  ]);

  const currentCluster = filteredClusters[currentIndex];
  const totalClusters = filteredClusters.length;

  const handlePrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(totalClusters - 1, prev + 1));
  };

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  if (!hasTopIssuesUI) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <PageFiltersContainer>
      <PageWrapper>
        <HeaderSection>
          <Flex justify="between" align="center">
            <Heading as="h1">{t('Top Issues')}</Heading>
            <Link to={`/organizations/${organization.slug}/issues/dynamic-groups/`}>
              <Button size="sm">{t('View Grid Layout')}</Button>
            </Link>
          </Flex>

          <Flex
            justify="between"
            align="center"
            wrap="wrap"
            gap="md"
            style={{marginTop: space(2)}}
          >
            <Flex gap="sm" align="center">
              <ProjectPageFilter />
              <CheckboxLabel>
                <Checkbox
                  checked={filterByAssignedToMe}
                  onChange={e => {
                    setFilterByAssignedToMe(e.target.checked);
                    setCurrentIndex(0);
                  }}
                  aria-label={t('Assigned to me')}
                  size="sm"
                />
                <Text size="sm">{t('Assigned to me')}</Text>
              </CheckboxLabel>
            </Flex>

            {!isPending && totalClusters > 0 && (
              <Flex align="center" gap="sm">
                <Text size="sm" variant="muted" style={{padding: `0 ${space(1)}`}}>
                  {currentIndex + 1} {t('of')} {totalClusters} {t('top issues')}
                </Text>
                <Button size="sm" onClick={handlePrevious} disabled={currentIndex <= 0}>
                  {t('Previous')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={currentIndex >= totalClusters - 1}
                >
                  {t('Next')}
                </Button>
              </Flex>
            )}
          </Flex>
        </HeaderSection>

        <ContentArea>
          {isPending ? (
            <LoadingIndicator />
          ) : totalClusters === 0 ? (
            <EmptyState>
              <Text variant="muted">{t('No top issues match the current filters')}</Text>
            </EmptyState>
          ) : currentCluster ? (
            <ClusterDetailCard cluster={currentCluster} />
          ) : null}
        </ContentArea>
      </PageWrapper>
    </PageFiltersContainer>
  );
}

const PageWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: ${p => p.theme.backgroundSecondary};
`;

const HeaderSection = styled('div')`
  padding: ${space(3)} ${space(4)} ${space(2)};
`;

const CheckboxLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  cursor: pointer;
`;

const ContentArea = styled('div')`
  flex: 1;
  padding: ${space(3)} ${space(4)};
`;

const EmptyState = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(4)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
`;

const CardContainer = styled('div')`
  display: flex;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const CardMain = styled('div')`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const CardSidebar = styled('div')`
  width: 200px;
  flex-shrink: 0;
  padding: ${space(3)};
  border-left: 1px solid ${p => p.theme.border};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    width: 100%;
    border-left: none;
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const CardHeader = styled('div')`
  padding: ${space(3)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const TagPill = styled('span')`
  display: inline-block;
  padding: ${space(0.5)} ${space(1)};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: 20px;
`;

const ContentSection = styled('div')`
  padding: ${space(3)};
`;

const CardFooter = styled('div')`
  padding: ${space(2)} ${space(3)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const AvatarStack = styled('div')`
  display: flex;
  align-items: center;
`;

const AvatarPlaceholder = styled('div')`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${p => p.theme.purple300};
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid ${p => p.theme.background};
  margin-left: -8px;

  &:first-child {
    margin-left: 0;
  }
`;

export default TopIssues;
