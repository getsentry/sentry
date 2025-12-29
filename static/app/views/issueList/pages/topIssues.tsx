import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {InlineCode} from 'sentry/components/core/code/inlineCode';
import {Disclosure} from 'sentry/components/core/disclosure/disclosure';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {NativeContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/nativeContent';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Placeholder from 'sentry/components/placeholder';
import Redirect from 'sentry/components/redirect';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconClock, IconFire, IconLink, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {EventsStats} from 'sentry/types/organization';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {isNativePlatform} from 'sentry/utils/platform';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {type GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

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

function useClusterEventsStats(groupIds: number[]) {
  const organization = useOrganization();

  return useApiQuery<EventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          query: `issue.id:[${groupIds.join(',')}]`,
          statsPeriod: '30d',
          interval: '1d',
          yAxis: 'count()',
          project: -1,
          referrer: 'top-issues.cluster-events-graph',
        },
      },
    ],
    {
      staleTime: 60000,
      enabled: groupIds.length > 0,
    }
  );
}

interface ClusterEventsGraphProps {
  groupIds: number[];
}

interface SinglePeriodGraphProps {
  groupIds: number[];
  title: string;
}

function SinglePeriodGraph({groupIds, title}: SinglePeriodGraphProps) {
  const theme = useTheme();
  const {data: eventsStats, isPending} = useClusterEventsStats(groupIds);

  const series = useMemo((): Series[] => {
    if (!eventsStats?.data) {
      return [];
    }

    const chartData = eventsStats.data.map(([timestamp, countData]) => ({
      name: timestamp * 1000,
      value: countData?.[0]?.count ?? 0,
    }));

    return [
      {
        seriesName: t('Events'),
        data: chartData,
      },
    ];
  }, [eventsStats]);

  const totalCount = useMemo(() => {
    if (!eventsStats?.data) {
      return 0;
    }
    return eventsStats.data.reduce(
      (sum, [, countData]) => sum + (countData?.[0]?.count ?? 0),
      0
    );
  }, [eventsStats]);

  return (
    <SingleGraphContainer>
      <Flex justify="between" align="center" style={{marginBottom: theme.space.xs}}>
        <Text size="xs" bold>
          {title}
        </Text>
        <Text size="xs" variant="muted">
          {totalCount.toLocaleString()}
        </Text>
      </Flex>
      {isPending ? (
        <Placeholder height="50px" />
      ) : (
        <MiniBarChart
          height={50}
          isGroupedByDate
          showTimeInTooltip
          series={series}
          colors={[theme.colors.gray300]}
          emphasisColors={[theme.colors.gray400]}
        />
      )}
    </SingleGraphContainer>
  );
}

function ClusterEventsGraph({groupIds}: ClusterEventsGraphProps) {
  return (
    <EventsGraphContainer>
      <SinglePeriodGraph groupIds={groupIds} title={t('Last 30 Days')} />
    </EventsGraphContainer>
  );
}

function getStacktraceFromEvent(event: Event): StacktraceType | null {
  const exceptionsWithStacktrace =
    event.entries
      .find(e => e.type === EntryType.EXCEPTION)
      ?.data?.values?.filter((exc: {stacktrace?: StacktraceType}) =>
        defined(exc.stacktrace)
      ) ?? [];

  const exceptionStacktrace: StacktraceType | undefined = isStacktraceNewestFirst()
    ? exceptionsWithStacktrace[exceptionsWithStacktrace.length - 1]?.stacktrace
    : exceptionsWithStacktrace[0]?.stacktrace;

  if (exceptionStacktrace) {
    return exceptionStacktrace;
  }

  const threads =
    event.entries.find(e => e.type === EntryType.THREADS)?.data?.values ?? [];
  const bestThread = findBestThread(threads);

  if (!bestThread) {
    return null;
  }

  const bestThreadStacktrace = getThreadStacktrace(false, bestThread);

  if (bestThreadStacktrace) {
    return bestThreadStacktrace;
  }

  return null;
}

interface ClusterStackTraceProps {
  groupId: number;
}

function ClusterStackTrace({groupId}: ClusterStackTraceProps) {
  const organization = useOrganization();
  const defaultIssueEvent = useDefaultIssueEvent();

  const {data: event, isPending} = useApiQuery<Event>(
    [
      `/organizations/${organization.slug}/issues/${groupId}/events/${defaultIssueEvent}/`,
      {
        query: {
          collapse: ['fullRelease'],
        },
      },
    ],
    {
      staleTime: 30000,
      enabled: groupId > 0,
    }
  );

  const stacktrace = useMemo(
    () => (event ? getStacktraceFromEvent(event) : null),
    [event]
  );

  if (isPending) {
    return <Placeholder height="200px" />;
  }

  if (!stacktrace || !event) {
    return (
      <Text size="sm" variant="muted">
        {t('No stack trace available for this issue.')}
      </Text>
    );
  }

  const includeSystemFrames = stacktrace.frames?.every(frame => !frame.inApp) ?? false;
  const framePlatform = stacktrace.frames?.find(frame => !!frame.platform)?.platform;
  const platform = framePlatform ?? event.platform ?? 'other';
  const newestFirst = isStacktraceNewestFirst();

  const commonProps = {
    data: stacktrace,
    includeSystemFrames,
    platform,
    newestFirst,
    event,
    isHoverPreviewed: true,
  };

  if (isNativePlatform(platform)) {
    return <NativeContent {...commonProps} hideIcon maxDepth={5} />;
  }

  return <StackTraceContent {...commonProps} expandFirstFrame hideIcon />;
}

interface DiscoverFacetTag {
  key: string;
  topValues: Array<{
    count: number;
    name: string | null;
    value: string | number;
  }>;
}

function useClusterTagFacets(groupIds: number[]) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const currentProjects = selection.projects ?? [];
  const currentEnvironments = selection.environments ?? [];

  const queryResult = useApiQuery<DiscoverFacetTag[]>(
    [
      `/organizations/${organization.slug}/events-facets/`,
      {
        query: {
          dataset: DiscoverDatasets.ERRORS,
          query: `issue.id:[${groupIds.join(',')}]`,
          statsPeriod: '30d',
          per_page: 50,
          ...(currentProjects.length ? {project: currentProjects} : {}),
          ...(currentEnvironments.length ? {environment: currentEnvironments} : {}),
        },
      },
    ],
    {
      enabled: groupIds.length !== 0,
      staleTime: 30000,
    }
  );

  const data = useMemo<GroupTag[] | undefined>(() => {
    if (!queryResult.data) {
      return undefined;
    }

    return queryResult.data
      .map(tag => {
        const topValues = tag.topValues.map(value => ({
          count: value.count,
          name: value.name ?? String(value.value),
          value: String(value.value),
          firstSeen: '',
          lastSeen: '',
        }));
        const totalValues = topValues.reduce((sum, value) => sum + value.count, 0);
        return {
          key: tag.key,
          name: tag.key,
          topValues,
          totalValues,
        };
      })
      .filter(tag => tag.topValues.length > 0);
  }, [queryResult.data]);

  return {
    data,
    isPending: queryResult.isPending,
    isError: queryResult.isError,
  };
}

interface DenseTagFacetsProps {
  groupIds: number[];
}

function DenseTagFacets({groupIds}: DenseTagFacetsProps) {
  const theme = useTheme();
  const {data: tags, isPending} = useClusterTagFacets(groupIds);

  if (isPending) {
    return <Placeholder height="60px" />;
  }

  if (!tags || tags.length === 0) {
    return (
      <Text size="sm" variant="muted">
        {t('No tags found')}
      </Text>
    );
  }

  return (
    <TagsTable>
      <TagsTableHeader>
        <Text size="xs" uppercase variant="muted">
          {t('Tag')}
        </Text>
        <Text size="xs" uppercase variant="muted">
          {t('Top %')}
        </Text>
        <Text size="xs" uppercase variant="muted">
          {t('Top Value')}
        </Text>
      </TagsTableHeader>
      <DenseTagsGrid>
        {tags.map((tag: GroupTag) => (
          <DenseTagItem key={tag.key} tag={tag} colors={theme.chart.getColorPalette(4)} />
        ))}
      </DenseTagsGrid>
    </TagsTable>
  );
}

interface DenseTagItemProps {
  colors: readonly string[];
  tag: GroupTag;
}

interface TagDistributionPreviewProps {
  colors: readonly string[];
  tag: GroupTag;
}

function TagDistributionPreview({tag, colors}: TagDistributionPreviewProps) {
  const theme = useTheme();
  const topValues = tag.topValues.slice(0, 3);
  const totalCount = tag.totalValues;
  const hasValues = topValues.length > 0;

  return (
    <DenseTagCard>
      <Text
        as="div"
        size="xs"
        bold
        uppercase
        variant="muted"
        ellipsis
        style={{marginBottom: theme.space.xs}}
      >
        {tag.key}
      </Text>
      {hasValues ? (
        <Fragment>
          <DenseTagBar>
            {topValues.map((value, index) => {
              const pct = totalCount > 0 ? (value.count / totalCount) * 100 : 0;
              return (
                <DenseTagSegment
                  key={value.value}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: colors[index] ?? theme.colors.gray300,
                  }}
                />
              );
            })}
          </DenseTagBar>
          <DenseTagValues>
            {topValues.map((value, index) => {
              const pct =
                totalCount > 0 ? Math.round((value.count / totalCount) * 100) : 0;
              return (
                <Tooltip key={value.value} title={value.name} skipWrapper>
                  <DenseTagChip>
                    <DenseTagDot
                      style={{backgroundColor: colors[index] ?? theme.colors.gray300}}
                    />
                    <Text size="xs" ellipsis align="left" style={{flex: 1}}>
                      {value.name || t('(empty)')}
                    </Text>
                    <Text size="xs" variant="muted" style={{flexShrink: 0}}>
                      {pct}%
                    </Text>
                  </DenseTagChip>
                </Tooltip>
              );
            })}
          </DenseTagValues>
        </Fragment>
      ) : (
        <Text size="sm" variant="muted">
          {t('No values available')}
        </Text>
      )}
    </DenseTagCard>
  );
}

function DenseTagItem({tag, colors}: DenseTagItemProps) {
  const topValue = tag.topValues[0];
  const totalCount = tag.totalValues;
  const topValuePct =
    topValue && totalCount > 0 ? Math.round((topValue.count / totalCount) * 100) : null;
  const hasValues = Boolean(topValue);

  return (
    <Tooltip
      title={<TagDistributionPreview tag={tag} colors={colors} />}
      skipWrapper
      maxWidth={360}
    >
      <TagRow>
        <Text size="sm" bold ellipsis>
          {tag.key}
        </Text>
        <TagPctCell>
          {hasValues && topValuePct !== null ? (
            <Text size="xs" variant="muted" style={{flexShrink: 0}}>
              {topValuePct}%
            </Text>
          ) : (
            <Text size="sm" variant="muted">
              {t('—')}
            </Text>
          )}
        </TagPctCell>
        {hasValues ? (
          <TagValueCell>
            <Text size="sm" ellipsis>
              {topValue?.name || t('(empty)')}
            </Text>
          </TagValueCell>
        ) : (
          <TagValueCell>
            <Text size="sm" variant="muted">
              {t('No values')}
            </Text>
          </TagValueCell>
        )}
      </TagRow>
    </Tooltip>
  );
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
  const theme = useTheme();
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
          <Heading as="h2" size="xl" style={{marginBottom: theme.space.xl}}>
            {renderWithInlineCode(cluster.title)}
          </Heading>
          <Flex
            wrap="wrap"
            align="center"
            gap="md"
            style={{marginBottom: theme.space.xl}}
          >
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

          <Flex wrap="wrap" gap="lg" style={{marginBottom: theme.space.xl}}>
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

        <Grid padding="sm" gap="sm">
          <Disclosure size="sm" expanded>
            <Disclosure.Title>{t('What went wrong')}</Disclosure.Title>
            <Disclosure.Content>
              <div style={{minHeight: 60}}>
                {cluster.summary ? (
                  <Text size="sm">{renderWithInlineCode(cluster.summary)}</Text>
                ) : (
                  <Text size="sm" variant="muted">
                    {t('No summary available')}
                  </Text>
                )}
              </div>
            </Disclosure.Content>
          </Disclosure>

          {cluster.group_ids[0] && (
            <Disclosure size="sm">
              <Disclosure.Title>{t('Example Stack Trace')}</Disclosure.Title>
              <Disclosure.Content>
                <ClusterStackTrace groupId={cluster.group_ids[0]} />
              </Disclosure.Content>
            </Disclosure>
          )}

          {cluster.group_ids.length > 0 && (
            <Disclosure size="sm">
              <Disclosure.Title>{t('Aggregate Tags')}</Disclosure.Title>
              <Disclosure.Content>
                <DenseTagFacets groupIds={cluster.group_ids} />
              </Disclosure.Content>
            </Disclosure>
          )}
        </Grid>

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
        <SidebarSection>
          <Heading as="h4" size="md" style={{marginBottom: theme.space.lg}}>
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
        </SidebarSection>

        <SidebarSection>
          <ClusterEventsGraph groupIds={cluster.group_ids} />
        </SidebarSection>
      </CardSidebar>
    </CardContainer>
  );
}

function TopIssues() {
  const theme = useTheme();
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
        <Grid padding="2xl 3xl xl">
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
            style={{marginTop: theme.space.xl}}
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
                <Text size="sm" variant="muted" style={{padding: `0 ${theme.space.md}`}}>
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
        </Grid>

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

const CheckboxLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  cursor: pointer;
`;

const ContentArea = styled('div')`
  flex: 1;
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']};
`;

const EmptyState = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${p => p.theme.space['3xl']};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
`;

const CardContainer = styled('div')`
  display: flex;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};

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
  width: 280px;
  flex-shrink: 0;
  padding: ${p => p.theme.space['2xl']};
  border-left: 1px solid ${p => p.theme.border};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    width: 100%;
    border-left: none;
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const SidebarSection = styled('div')`
  &:not(:last-child) {
    margin-bottom: ${p => p.theme.space['2xl']};
    padding-bottom: ${p => p.theme.space['2xl']};
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const CardHeader = styled('div')`
  padding: ${p => p.theme.space['2xl']};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const TagPill = styled('span')`
  display: inline-block;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: 20px;
`;

const CardFooter = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
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

const EventsGraphContainer = styled('div')`
  padding: ${p => p.theme.space.md} 0;
`;

const SingleGraphContainer = styled('div')`
  &:not(:last-child) {
    padding-bottom: ${p => p.theme.space.md};
  }
`;

const TagsTable = styled('div')`
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 70px minmax(180px, 2fr);
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const TagsTableHeader = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const DenseTagsGrid = styled('div')`
  display: contents;
`;

const DenseTagCard = styled('div')`
  min-width: 250px;
`;

const DenseTagBar = styled('div')`
  display: flex;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: ${p => p.theme.backgroundSecondary};
  margin-bottom: ${p => p.theme.space.sm};
`;

const DenseTagValues = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

const DenseTagSegment = styled('div')`
  height: 100%;
  min-width: 2px;
`;

const DenseTagChip = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: 0;
  background: transparent;
  border-radius: 0;
  width: 100%;
  cursor: default;
`;

const DenseTagDot = styled('span')`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const TagRow = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  align-items: baseline;
  cursor: default;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const TagValueCell = styled('div')`
  display: flex;
  align-items: baseline;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
`;

const TagPctCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
`;

export default TopIssues;
