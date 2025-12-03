import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {InlineCode} from 'sentry/components/core/code/inlineCode';
import {Disclosure} from 'sentry/components/core/disclosure';
import {Link} from 'sentry/components/core/link';
import {TextArea} from 'sentry/components/core/textarea';
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
import {IconClose, IconFire, IconUpload} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

/**
 * Parses a string and renders backtick-wrapped text as inline code elements.
 * Example: "Error in `Contains` filter" becomes ["Error in ", <InlineCode>Contains</InlineCode>, " filter"]
 */
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

interface AssignedEntity {
  email: string | null;
  id: string;
  name: string;
  type: string;
}

interface ClusterSummary {
  assignedTo: AssignedEntity[];
  cluster_avg_similarity: number | null;
  // unused
  cluster_id: number;
  cluster_min_similarity: number | null;
  // unused
  cluster_size: number | null;
  // unused
  description: string;
  fixability_score: number | null;
  group_ids: number[];
  issue_titles: string[];
  project_ids: number[];
  tags: string[];
  title: string;
  code_area_tags?: string[];
  error_type_tags?: string[];
  service_tags?: string[];
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

interface ClusterTagsProps {
  cluster: ClusterSummary;
  onTagClick?: (tag: string) => void;
  selectedTags?: Set<string>;
}

function ClusterTags({cluster, onTagClick, selectedTags}: ClusterTagsProps) {
  const hasServiceTags = cluster.service_tags && cluster.service_tags.length > 0;
  const hasErrorTypeTags = cluster.error_type_tags && cluster.error_type_tags.length > 0;
  const hasCodeAreaTags = cluster.code_area_tags && cluster.code_area_tags.length > 0;

  if (!hasServiceTags && !hasErrorTypeTags && !hasCodeAreaTags) {
    return null;
  }

  const renderTag = (tag: string, key: string) => {
    const isSelected = selectedTags?.has(tag);
    return (
      <ClickableTag
        key={key}
        onClick={e => {
          e.stopPropagation();
          onTagClick?.(tag);
        }}
        isSelected={isSelected}
      >
        {tag}
      </ClickableTag>
    );
  };

  return (
    <Flex wrap="wrap" gap="xs" align="center">
      {hasServiceTags &&
        cluster.service_tags!.map(tag => renderTag(tag, `service-${tag}`))}
      {hasErrorTypeTags &&
        cluster.error_type_tags!.map(tag => renderTag(tag, `error-${tag}`))}
      {hasCodeAreaTags &&
        cluster.code_area_tags!.map(tag => renderTag(tag, `code-${tag}`))}
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
  onTagClick,
  selectedTags,
}: {
  cluster: ClusterSummary;
  onRemove: (clusterId: number) => void;
  onTagClick?: (tag: string) => void;
  selectedTags?: Set<string>;
}) {
  const organization = useOrganization();
  const issueCount = cluster.group_ids.length;
  const [showDescription, setShowDescription] = useState(false);
  const clusterStats = useClusterStats(cluster.group_ids);

  return (
    <CardContainer>
      {/* Zone 1: Title + Description (Primary Focus) */}
      <CardHeader>
        <ClusterTitle>{renderWithInlineCode(cluster.title)}</ClusterTitle>
        <ClusterTags
          cluster={cluster}
          onTagClick={onTagClick}
          selectedTags={selectedTags}
        />
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
      </CardHeader>

      {/* Zone 2: Stats (Secondary Context) */}
      <StatsSection>
        <PrimaryStats>
          <EventsMetric>
            <IconFire size="sm" />
            {clusterStats.isPending ? (
              <Text size="md" variant="muted">
                –
              </Text>
            ) : (
              <EventsCount>{clusterStats.totalEvents.toLocaleString()}</EventsCount>
            )}
            <Text size="sm" variant="muted">
              {tn('event', 'events', clusterStats.totalEvents)}
            </Text>
          </EventsMetric>
        </PrimaryStats>
        <SecondaryStats>
          {!clusterStats.isPending && clusterStats.lastSeen && (
            <SecondaryStatItem>
              <Text size="xs" variant="muted">
                {t('Last seen')}
              </Text>
              <TimeSince
                tooltipPrefix={t('Last Seen')}
                date={clusterStats.lastSeen}
                suffix={t('ago')}
                unitStyle="short"
              />
            </SecondaryStatItem>
          )}
          {!clusterStats.isPending && clusterStats.firstSeen && (
            <SecondaryStatItem>
              <Text size="xs" variant="muted">
                {t('Age')}
              </Text>
              <TimeSince
                tooltipPrefix={t('First Seen')}
                date={clusterStats.firstSeen}
                suffix={t('old')}
                unitStyle="short"
              />
            </SecondaryStatItem>
          )}
        </SecondaryStats>
      </StatsSection>

      {/* Zone 3: Nested Issues (Detail Content) */}
      <IssuesSection>
        <IssuesSectionHeader>
          <Text size="sm" bold uppercase>
            {tn('%s Issue', '%s Issues', issueCount)}
          </Text>
        </IssuesSectionHeader>
        <IssuesList>
          <ClusterIssues groupIds={cluster.group_ids} />
          {cluster.group_ids.length > 3 && (
            <MoreIssuesIndicator>
              {t('+ %s more similar issues', cluster.group_ids.length - 3)}
            </MoreIssuesIndicator>
          )}
        </IssuesList>
      </IssuesSection>

      {/* Zone 4: Actions (Tertiary) */}
      <CardFooter>
        <Button size="sm" priority="primary" onClick={() => onRemove(cluster.cluster_id)}>
          {t('Resolve All')}
        </Button>
        <Link
          to={`/organizations/${organization.slug}/issues/?query=issue.id:[${cluster.group_ids.join(',')}]`}
        >
          <Button size="sm">{t('View All Issues')}</Button>
        </Link>
      </CardFooter>
    </CardContainer>
  );
}

function DynamicGrouping() {
  const organization = useOrganization();
  const user = useUser();
  const {teams: userTeams} = useUserTeams();
  const {selection} = usePageFilters();
  const [filterByAssignedToMe, setFilterByAssignedToMe] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [removedClusterIds, setRemovedClusterIds] = useState(new Set<number>());
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [jsonInputValue, setJsonInputValue] = useState('');
  const [customClusterData, setCustomClusterData] = useState<ClusterSummary[] | null>(
    null
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [disableFilters, setDisableFilters] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

  // Fetch cluster data from API
  const {data: topIssuesResponse, isPending} = useApiQuery<TopIssuesResponse>(
    [`/organizations/${organization.slug}/top-issues/`],
    {
      staleTime: 60000,
      enabled: customClusterData === null, // Only fetch if no custom data
    }
  );

  const handleParseJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInputValue);
      // Support both {data: [...]} format and direct array format
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
  }, [jsonInputValue]);

  const handleClearCustomData = useCallback(() => {
    setCustomClusterData(null);
    setJsonInputValue('');
    setJsonError(null);
    setDisableFilters(false);
  }, []);

  const clusterData = customClusterData ?? topIssuesResponse?.data ?? [];
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

  const handleRemoveCluster = (clusterId: number) => {
    setRemovedClusterIds(prev => new Set([...prev, clusterId]));
  };

  const handleTagClick = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const handleClearTagFilter = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
  };

  const handleClearAllTagFilters = () => {
    setSelectedTags(new Set());
  };

  // Helper to check if a cluster has any of the selected tags
  const clusterHasSelectedTags = (cluster: ClusterSummary): boolean => {
    if (selectedTags.size === 0) return true;

    const allClusterTags = [
      ...(cluster.service_tags ?? []),
      ...(cluster.error_type_tags ?? []),
      ...(cluster.code_area_tags ?? []),
    ];

    return Array.from(selectedTags).every(tag => allClusterTags.includes(tag));
  };

  // Helper to check if a cluster has any of the selected projects
  const clusterHasSelectedProjects = (cluster: ClusterSummary): boolean => {
    // If "All Projects" is selected (indicated by -1) or no specific projects are selected, show all clusters
    if (
      selection.projects.length === 0 ||
      selection.projects.includes(ALL_ACCESS_PROJECTS)
    ) {
      return true;
    }
    return cluster.project_ids.some(projectId => selection.projects.includes(projectId));
  };

  // When using custom JSON data with filters disabled, skip all filtering and sorting
  const shouldSkipFilters = isUsingCustomData && disableFilters;
  const filteredAndSortedClusters = shouldSkipFilters
    ? clusterData.filter(cluster => !removedClusterIds.has(cluster.cluster_id))
    : clusterData
        .filter(cluster => {
          if (removedClusterIds.has(cluster.cluster_id)) return false;

          // Filter by selected tags
          if (!clusterHasSelectedTags(cluster)) return false;

          // Filter by selected projects
          if (!clusterHasSelectedProjects(cluster)) return false;

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
    <PageFiltersContainer>
      <PageWrapper>
        <HeaderSection>
          <Flex align="center" gap="md" style={{marginBottom: space(2)}}>
            <ClickableHeading as="h1" onClick={() => setShowDevTools(prev => !prev)}>
              {t('Top Issues')}
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
              <Text size="sm" variant="muted">
                {tn(
                  'Viewing %s cluster containing %s issue',
                  'Viewing %s clusters containing %s issues',
                  filteredAndSortedClusters.length,
                  totalIssues
                )}
                {shouldSkipFilters && ` ${t('(filters disabled)')}`}
              </Text>

              {selectedTags.size > 0 && (
                <ActiveTagFilters>
                  <Text size="sm" variant="muted">
                    {t('Filtering by tags:')}
                  </Text>
                  <Flex wrap="wrap" gap="xs" align="center">
                    {Array.from(selectedTags).map(tag => (
                      <ActiveTagChip key={tag}>
                        <Text size="xs">{tag}</Text>
                        <Button
                          size="zero"
                          borderless
                          icon={<IconClose size="xs" />}
                          aria-label={t('Remove filter for %s', tag)}
                          onClick={() => handleClearTagFilter(tag)}
                        />
                      </ActiveTagChip>
                    ))}
                    <Button size="xs" borderless onClick={handleClearAllTagFilters}>
                      {t('Clear all')}
                    </Button>
                  </Flex>
                </ActiveTagFilters>
              )}

              {showDevTools && !shouldSkipFilters && (
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
                  onTagClick={handleTagClick}
                  selectedTags={selectedTags}
                />
              ))}
            </CardsGrid>
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
`;

const ClickableHeading = styled(Heading)`
  cursor: pointer;
  user-select: none;
`;

const CardsSection = styled('div')`
  flex: 1;
  padding: ${space(2)} ${space(4)} ${space(4)};
`;

const CardsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${space(3)};
  align-items: stretch;

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
  }
`;

// Card with subtle hover effect
const CardContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: ${p => p.theme.purple200};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
`;

// Zone 1: Title area - clean and prominent
const CardHeader = styled('div')`
  padding: ${space(3)} ${space(3)} ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ClusterTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  line-height: 1.3;
  word-break: break-word;
`;

// Zone 2: Stats section with visual hierarchy
const StatsSection = styled('div')`
  padding: ${space(2)} ${space(3)};
  background: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.innerBorder};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(2)};
  flex-wrap: wrap;
`;

const PrimaryStats = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
`;

const EventsMetric = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.red300};
`;

const EventsCount = styled('span')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: 700;
  color: ${p => p.theme.textColor};
  font-variant-numeric: tabular-nums;
`;

const SecondaryStats = styled('div')`
  display: flex;
  gap: ${space(3)};
`;

const SecondaryStatItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
`;

// Zone 3: Issues list with clear containment
const IssuesSection = styled('div')`
  padding: ${space(2)} ${space(3)};
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const IssuesSectionHeader = styled('div')`
  margin-bottom: ${space(1.5)};
  color: ${p => p.theme.subText};
  letter-spacing: 0.5px;
`;

const IssuesList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
`;

const MoreIssuesIndicator = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  text-align: center;
  font-style: italic;
  padding-top: ${space(1)};
`;

// Zone 4: Footer with actions
const CardFooter = styled('div')`
  padding: ${space(2)} ${space(3)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
`;

// Issue preview link with hover effect - consistent with issue feed cards
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
  font-weight: 600;
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
  opacity: 0.9;
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

const JsonInputContainer = styled('div')`
  margin-bottom: ${space(2)};
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const CustomDataBadge = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.yellow100};
  border: 1px solid ${p => p.theme.yellow300};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.yellow400};
`;

const ClickableTag = styled(Tag)<{isSelected?: boolean}>`
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease,
    box-shadow 0.15s ease;
  user-select: none;

  ${p =>
    p.isSelected &&
    `
    background: ${p.theme.purple100};
    border-color: ${p.theme.purple300};
    color: ${p.theme.purple400};
  `}

  &:hover {
    background: ${p => (p.isSelected ? p.theme.purple200 : p.theme.gray100)};
    border-color: ${p => (p.isSelected ? p.theme.purple400 : p.theme.gray300)};
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
    box-shadow: none;
  }
`;

const ActiveTagFilters = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-top: ${space(1.5)};
  flex-wrap: wrap;
`;

const ActiveTagChip = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(1)};
  background: ${p => p.theme.purple100};
  border: 1px solid ${p => p.theme.purple200};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.purple400};
`;

export default DynamicGrouping;
