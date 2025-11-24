import {Fragment, useState} from 'react';
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
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

interface AssignedEntity {
  email: string | null; // unused
  id: string;
  name: string; // unused
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

  if (isPending) {
    return <LoadingIndicator size={24} />;
  }

  if (!groups || groups.length === 0) {
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

  return (
    <CardContainer>
      <Flex
        justify="between"
        align="start"
        gap="md"
        paddingBottom="md"
        borderBottom="primary"
      >
        <Disclosure>
          <Disclosure.Title>
            <Heading as="h3" size="md" style={{wordBreak: 'break-word'}}>
              {cluster.title}
            </Heading>
          </Disclosure.Title>
          <Disclosure.Content>
            <Text as="p" variant="muted" style={{marginBottom: space(1.5)}}>
              {cluster.description}
            </Text>
            {cluster.fixability_score !== null && (
              <Text size="sm" variant="muted">
                {t('%s%% confidence', Math.round(cluster.fixability_score * 100))}
              </Text>
            )}
          </Disclosure.Content>
        </Disclosure>
        <IssueCountBadge>
          <IssueCountNumber>{issueCount}</IssueCountNumber>
          <Text size="xs" variant="muted" uppercase>
            {tn('issue', 'issues', issueCount)}
          </Text>
        </IssueCountBadge>
      </Flex>

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
  const {teams} = useUserTeams();
  const [filterByAssignedToMe, setFilterByAssignedToMe] = useState(true);
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
            (entity.type === 'team' && teams.some(team => team.id === entity.id))
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
    <Container padding="lg" maxWidth="1600px" margin="0 auto">
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

      {isPending ? (
        <LoadingIndicator />
      ) : (
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
            marginBottom="lg"
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
                </Flex>
              </Disclosure.Content>
            </Disclosure>
          </Container>

          {filteredAndSortedClusters.length === 0 ? (
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
        </Fragment>
      )}
    </Container>
  );
}

// Grid layout for cards - needs CSS grid
const CardsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: ${space(3)};
`;

// Card with hover effect - needs custom transition/hover styles
const CardContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

// Issue count badge with custom background color
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

// Issue preview link with hover transform effect
const IssuePreviewLink = styled(Link)`
  display: block;
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    transform 0.15s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    background: ${p => p.theme.backgroundElevated};
    transform: translateX(2px);
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

export default DynamicGrouping;
