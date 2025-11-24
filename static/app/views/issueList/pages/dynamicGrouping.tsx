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
import IssueReplayCount from 'sentry/components/group/issueReplayCount';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import Redirect from 'sentry/components/redirect';
import {IconChat, IconStar} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
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

// Compact issue preview for dynamic grouping - no short ID or quick fix icon
function CompactIssuePreview({group}: {group: Group}) {
  const organization = useOrganization();
  const {getReplayCountForIssue} = useReplayCountForIssues();

  const showReplayCount =
    organization.features.includes('session-replay') &&
    projectCanLinkToReplay(organization, group.project) &&
    group.issueCategory &&
    !!getReplayCountForIssue(group.id, group.issueCategory);

  const issuesPath = `/organizations/${organization.slug}/issues/`;
  const {subtitle} = getTitle(group);

  const items = [
    group.project ? (
      <ShadowlessProjectBadge project={group.project} avatarSize={12} hideName />
    ) : null,
    group.isUnhandled ? <UnhandledTag /> : null,
    group.count ? (
      <EventCount>{tn('%s event', '%s events', group.count)}</EventCount>
    ) : null,
    group.lifetime || group.firstSeen || group.lastSeen ? (
      <TimesTag
        lastSeen={group.lifetime?.lastSeen || group.lastSeen}
        firstSeen={group.lifetime?.firstSeen || group.firstSeen}
      />
    ) : null,
    group.numComments > 0 ? (
      <CommentsLink
        to={{
          pathname: `${issuesPath}${group.id}/activity/`,
          query: {filter: 'comments'},
        }}
      >
        <IconChat
          size="xs"
          color={
            group.subscriptionDetails?.reason === 'mentioned' ? 'successText' : undefined
          }
        />
        <span>{group.numComments}</span>
      </CommentsLink>
    ) : null,
    showReplayCount ? <IssueReplayCount group={group} /> : null,
  ].filter(defined);

  return (
    <CompactIssueWrapper>
      <CompactTitle>
        {group.isBookmarked && (
          <IconWrapper>
            <IconStar isSolid color="yellow300" size="xs" />
          </IconWrapper>
        )}
        <EventOrGroupTitle data={group} withStackTracePreview />
      </CompactTitle>
      <CompactMessage
        data={group}
        level={group.level}
        message={getMessage(group)}
        type={group.type}
      />
      {subtitle && <CompactLocation>{subtitle}</CompactLocation>}
      {items.length > 0 && (
        <CompactExtra>
          {items.map((item, i) => (
            <Fragment key={i}>
              {item}
              {i < items.length - 1 ? <CompactSeparator /> : null}
            </Fragment>
          ))}
        </CompactExtra>
      )}
    </CompactIssueWrapper>
  );
}

// Fetch and display actual issues from the group_ids
function ClusterIssues({groupIds}: {groupIds: number[]}) {
  const organization = useOrganization();

  // Only fetch first 3 issues for preview
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
      staleTime: 60000, // Cache for 1 minute
    }
  );

  if (isPending) {
    return (
      <Flex direction="column" gap="sm">
        {[0, 1, 2].map(i => (
          <Placeholder key={i} height="70px" />
        ))}
      </Flex>
    );
  }

  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <Flex direction="column" gap="sm">
      {groups.map(group => (
        <IssuePreviewContainer
          key={group.id}
          to={`/organizations/${organization.slug}/issues/${group.id}/`}
        >
          <CompactIssuePreview group={group} />
        </IssuePreviewContainer>
      ))}
    </Flex>
  );
}

// Individual cluster card
function ClusterCard({
  cluster,
  onRemove,
  isRemoving,
}: {
  cluster: ClusterSummary;
  isRemoving: boolean;
  onRemove: (clusterId: number) => void;
}) {
  const organization = useOrganization();

  return (
    <CardContainer isRemoving={isRemoving}>
      <Flex
        justify="between"
        align="start"
        gap="sm"
        paddingBottom="md"
        marginBottom="md"
        borderBottom="primary"
      >
        <TitleContainer direction="column" gap="xs">
          <StyledDisclosure>
            <Disclosure.Title>
              <TitleHeading as="h3" size="md">
                {cluster.title}
              </TitleHeading>
            </Disclosure.Title>
            <Disclosure.Content>
              <SummaryText variant="muted">{cluster.description}</SummaryText>
              {cluster.fixability_score !== null && (
                <ConfidenceText size="sm" variant="muted">
                  {t('%s%% confidence', Math.round(cluster.fixability_score * 100))}
                </ConfidenceText>
              )}
            </Disclosure.Content>
          </StyledDisclosure>
        </TitleContainer>
        <IssueCount>
          <CountNumber>{cluster.cluster_size ?? cluster.group_ids.length}</CountNumber>
          <CountLabel size="xs" variant="muted">
            {tn('issue', 'issues', cluster.cluster_size ?? cluster.group_ids.length)}
          </CountLabel>
        </IssueCount>
      </Flex>

      <Flex direction="column" flex="1">
        <ClusterIssues groupIds={cluster.group_ids} />

        {cluster.group_ids.length > 3 && (
          <Text
            size="sm"
            variant="muted"
            style={{marginTop: space(1), fontStyle: 'italic', textAlign: 'center'}}
          >
            {t('+ %s more similar issues', cluster.group_ids.length - 3)}
          </Text>
        )}
      </Flex>

      <Flex justify="end" align="center" gap="xs" paddingTop="md">
        <Button size="sm" priority="primary" onClick={() => onRemove(cluster.cluster_id)}>
          {t('Resolve')}
        </Button>
        <Button size="sm" onClick={() => onRemove(cluster.cluster_id)}>
          {t('Ignore')}
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
  const {teams} = useUserTeams();
  const [filterByAssignedToMe, setFilterByAssignedToMe] = useState(true);
  const [minFixabilityScore, setMinFixabilityScore] = useState(50);
  const [removingClusterId, setRemovingClusterId] = useState<number | null>(null);
  const [removedClusterIds, setRemovedClusterIds] = useState<Set<number>>(new Set());

  // Fetch cluster data from API
  const {data: topIssuesResponse, isPending} = useApiQuery<TopIssuesResponse>(
    [`/organizations/${organization.slug}/top-issues/`],
    {
      staleTime: 60000, // Cache for 1 minute
    }
  );

  const clusterData = useMemo(
    () => topIssuesResponse?.data ?? [],
    [topIssuesResponse?.data]
  );

  const handleRemoveCluster = (clusterId: number) => {
    // Start animation
    setRemovingClusterId(clusterId);

    // Wait for animation to complete before removing
    setTimeout(() => {
      const updatedRemovedIds = new Set(removedClusterIds);
      updatedRemovedIds.add(clusterId);
      setRemovedClusterIds(updatedRemovedIds);
      setRemovingClusterId(null);
    }, 300); // Match the animation duration
  };

  // Check if a cluster has at least one issue assigned to the current user or their teams
  const isClusterAssignedToMe = useMemo(() => {
    const userId = user.id;
    const teamIds = teams.map(team => team.id);

    return (cluster: ClusterSummary) => {
      // If no assignedTo data, include the cluster
      if (!cluster.assignedTo || cluster.assignedTo.length === 0) {
        return false;
      }

      // Check if any assigned entity matches the user or their teams
      return cluster.assignedTo.some(entity => {
        if (entity.type === 'user' && entity.id === userId) {
          return true;
        }
        if (entity.type === 'team' && teamIds.includes(entity.id)) {
          return true;
        }
        return false;
      });
    };
  }, [user.id, teams]);

  // Filter and sort clusters by fixability score (descending)
  const filteredAndSortedClusters = useMemo(() => {
    return [...clusterData]
      .filter((cluster: ClusterSummary) => {
        // Filter out removed clusters
        if (removedClusterIds.has(cluster.cluster_id)) {
          return false;
        }

        // Filter by fixability score - hide clusters below threshold
        const fixabilityScore = (cluster.fixability_score ?? 0) * 100;
        if (fixabilityScore < minFixabilityScore) {
          return false;
        }

        // If "Assigned to Me" filter is enabled, only show clusters assigned to the user
        if (filterByAssignedToMe) {
          return isClusterAssignedToMe(cluster);
        }
        return true;
      })
      .sort(
        (a: ClusterSummary, b: ClusterSummary) =>
          (b.fixability_score ?? 0) - (a.fixability_score ?? 0)
      );
  }, [
    clusterData,
    removedClusterIds,
    filterByAssignedToMe,
    minFixabilityScore,
    isClusterAssignedToMe,
  ]);

  const totalIssues = useMemo(() => {
    return filteredAndSortedClusters.reduce(
      (sum: number, c: ClusterSummary) => sum + (c.cluster_size ?? c.group_ids.length),
      0
    );
  }, [filteredAndSortedClusters]);

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  if (!hasTopIssuesUI) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <PageContainer>
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

      <PageHeader>
        <Heading as="h1">{t('Top Issues')}</Heading>
      </PageHeader>

      {isPending ? (
        <Flex direction="column" gap="md" marginTop="lg">
          {[0, 1, 2].map(i => (
            <Placeholder key={i} height="200px" />
          ))}
        </Flex>
      ) : (
        <Fragment>
          <Flex marginBottom="lg">
            <Text size="sm" variant="muted">
              {tn(
                'Viewing %s issue in %s cluster',
                'Viewing %s issues across %s clusters',
                totalIssues,
                filteredAndSortedClusters.length
              )}
            </Text>
          </Flex>

          <Container
            padding="md"
            border="primary"
            radius="md"
            marginBottom="lg"
            background="primary"
          >
            <Disclosure>
              <Disclosure.Title>
                <Text size="sm" bold>
                  {t('More Filters')}
                </Text>
              </Disclosure.Title>
              <Disclosure.Content>
                <AdvancedFilterContent>
                  <Flex gap="sm" align="center">
                    <Checkbox
                      checked={filterByAssignedToMe}
                      onChange={e => setFilterByAssignedToMe(e.target.checked)}
                      aria-label={t('Show only issues assigned to me')}
                      size="sm"
                    />
                    <Text size="sm" variant="muted">
                      {t('Only show issues assigned to me')}
                    </Text>
                  </Flex>
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
                </AdvancedFilterContent>
              </Disclosure.Content>
            </Disclosure>
          </Container>

          {filteredAndSortedClusters.length === 0 ? (
            <Container padding="lg" border="primary" radius="md" background="primary">
              <Text variant="muted" style={{textAlign: 'center'}}>
                {t('No clusters match the current filters')}
              </Text>
            </Container>
          ) : (
            <CardsGrid>
              {filteredAndSortedClusters.map((cluster: ClusterSummary) => (
                <ClusterCard
                  key={cluster.cluster_id}
                  cluster={cluster}
                  onRemove={handleRemoveCluster}
                  isRemoving={removingClusterId === cluster.cluster_id}
                />
              ))}
            </CardsGrid>
          )}
        </Fragment>
      )}
    </PageContainer>
  );
}

// Styled Components
const PageContainer = styled('div')`
  padding: ${space(3)} ${space(4)};
  max-width: 1600px;
  margin: 0 auto;
`;

const PageHeader = styled('div')`
  margin-bottom: ${space(2)};
`;

const CardsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: ${space(3)};
`;

const CardContainer = styled('div')<{isRemoving: boolean}>`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  opacity: ${p => (p.isRemoving ? 0 : 1)};
  transform: ${p => (p.isRemoving ? 'scale(0.95)' : 'scale(1)')};
  transition:
    opacity 0.3s ease,
    transform 0.3s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const SummaryText = styled(Text)`
  line-height: 1.6;
  display: block;
  margin-bottom: ${space(1.5)};
`;

const ConfidenceText = styled(Text)`
  display: block;
  margin-top: ${space(1.5)};
`;

const TitleContainer = styled(Flex)`
  flex: 1;
  min-width: 0;
`;

const StyledDisclosure = styled(Disclosure)`
  /* Target the button inside Disclosure.Title */
  button {
    width: 100%;
    display: flex !important;
    text-align: left !important;
    white-space: normal;
    word-break: break-word;
    padding: 0;
    margin: 0;
    justify-content: flex-start !important;
    align-items: flex-start !important;
  }

  /* Ensure inner content is left-aligned */
  button > *,
  button span {
    text-align: left !important;
    justify-content: flex-start !important;
  }

  /* Adjust content padding */
  & > div:last-child {
    padding-top: ${space(1)};
  }
`;

const TitleHeading = styled(Heading)`
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  text-align: left;
`;

const IssueCount = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  flex-shrink: 0;
`;

const CountNumber = styled('div')`
  font-size: 24px;
  font-weight: 600;
  color: ${p => p.theme.purple400};
  line-height: 1;
`;

const CountLabel = styled(Text)`
  margin-top: ${space(0.25)};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  display: inline-block;
  width: 6ch;
  text-align: center;
`;

const IssuePreviewContainer = styled(Link)`
  display: block;
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  transition: all 0.15s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    background: ${p => p.theme.backgroundElevated};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transform: translateX(2px);
  }
`;

const CompactIssueWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
`;

const CompactTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
  line-height: 1.4;
  text-align: left;
  ${p => p.theme.overflowEllipsis};

  & em {
    font-size: ${p => p.theme.fontSize.sm};
    font-style: normal;
    font-weight: ${p => p.theme.fontWeight.normal};
    color: ${p => p.theme.subText};
  }
`;

const CompactMessage = styled(EventMessage)`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.4;
`;

const CompactLocation = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.3;
  ${p => p.theme.overflowEllipsis};
`;

const CompactExtra = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(0.75)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
  line-height: 1.2;

  & > a {
    color: ${p => p.theme.subText};
  }
`;

const CompactSeparator = styled('div')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.innerBorder};
  border-radius: 1px;
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  * > img {
    box-shadow: none;
  }
`;

const CommentsLink = styled(Link)`
  display: inline-grid;
  gap: ${space(0.5)};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.textColor};
`;

const IconWrapper = styled('span')`
  display: inline-flex;
  margin-right: ${space(0.5)};
`;

const EventCount = styled('span')`
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const AdvancedFilterContent = styled('div')`
  padding: ${space(2)} 0;
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
`;

export default DynamicGrouping;
