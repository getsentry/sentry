import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {InlineCode} from 'sentry/components/core/code/inlineCode';
import {Disclosure} from 'sentry/components/core/disclosure';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  CrumbContainer,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {NativeContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/nativeContent';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import GroupList from 'sentry/components/issues/groupList';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconClock, IconFire, IconLink, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {GroupSubstatus} from 'sentry/types/group';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {isNativePlatform} from 'sentry/utils/platform';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {type GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';
import type {ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

interface AssignedEntity {
  email: string | null;
  id: string;
  name: string;
  type: string;
}

export interface ClusterSummary {
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
  explorer_run_id?: number;
  impact?: string;
  location?: string;
  service_tags?: string[];
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

export function useClusterStats(groupIds: number[]): ClusterStats {
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

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let newIssuesCount = 0;

    let hasRegressedIssues = false;

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

      if (group.substatus === GroupSubstatus.REGRESSED) {
        hasRegressedIssues = true;
      }

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

export function renderWithInlineCode(text: string): React.ReactNode {
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

interface SeerExplorerRunResponse {
  session: {
    blocks: Array<{
      id: string;
      message: {
        content: string;
        role: 'user' | 'assistant' | 'tool_use';
      };
      timestamp: string;
      merged_file_patches?: ExplorerFilePatch[];
    }>;
    status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
    updated_at: string;
    pending_user_input?: {
      data?: {
        patches?: ExplorerFilePatch[];
      };
      input_type?: string;
    } | null;
  } | null;
}

function useSeerExplorerRun(runId: number | undefined) {
  const organization = useOrganization();

  return useApiQuery<SeerExplorerRunResponse>(
    [`/organizations/${organization.slug}/seer/explorer-chat/${runId}/`],
    {
      staleTime: 60000,
      enabled: runId !== undefined && runId > 0,
    }
  );
}

interface SuggestedCodeChangeProps {
  runId: number;
}

function SuggestedCodeChange({runId}: SuggestedCodeChangeProps) {
  const {data: explorerData, isPending} = useSeerExplorerRun(runId);

  const filePatches = useMemo(() => {
    if (!explorerData?.session) {
      return [];
    }

    const patches: ExplorerFilePatch[] = [];

    if (
      explorerData.session.pending_user_input?.input_type === 'file_change_approval' &&
      explorerData.session.pending_user_input.data?.patches
    ) {
      patches.push(...explorerData.session.pending_user_input.data.patches);
    }

    if (explorerData.session.blocks) {
      for (const block of explorerData.session.blocks) {
        if (block.merged_file_patches) {
          patches.push(...block.merged_file_patches);
        }
      }
    }

    return patches;
  }, [explorerData]);

  if (isPending) {
    return <Placeholder height="100px" />;
  }

  if (filePatches.length === 0) {
    return (
      <Text size="sm" variant="muted">
        {t('No code changes suggested for this issue.')}
      </Text>
    );
  }

  return (
    <Flex direction="column" gap="md">
      {filePatches.map((filePatch, index) => (
        <FileDiffViewer
          key={`${filePatch.repo_name}-${filePatch.patch.path}-${index}`}
          patch={filePatch.patch}
          repoName={filePatch.repo_name}
          showBorder
          collapsible
          defaultExpanded={index === 0}
        />
      ))}
    </Flex>
  );
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
    <Grid
      columns="minmax(160px, 1fr) minmax(90px, 1fr) 70px minmax(180px, 2fr)"
      border="primary"
      radius="md"
      overflow="hidden"
    >
      <TagsTableHeader>
        <Text size="xs" uppercase variant="muted">
          {t('Tag')}
        </Text>
        <Text size="xs" uppercase variant="muted">
          {t('Distribution')}
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
    </Grid>
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
  const topValues = tag.topValues.slice(0, 4);
  const totalCount = tag.totalValues;
  const hasValues = topValues.length > 0;

  return (
    <Container minWidth={250}>
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
          <Flex direction="column" gap="sm">
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
          </Flex>
        </Fragment>
      ) : (
        <Text size="sm" variant="muted">
          {t('No values available')}
        </Text>
      )}
    </Container>
  );
}

function DenseTagItem({tag, colors}: DenseTagItemProps) {
  const theme = useTheme();
  const topValue = tag.topValues[0];
  const totalCount = tag.totalValues;
  const topValuePct =
    topValue && totalCount > 0 ? Math.round((topValue.count / totalCount) * 100) : null;
  const barValues = tag.topValues.slice(0, 4);
  const hasValues = Boolean(topValue);

  return (
    <TagRow>
      <Text size="sm" bold ellipsis>
        {tag.key}
      </Text>
      <Flex align="center" minWidth={0} alignSelf="stretch">
        {hasValues ? (
          <Tooltip
            title={<TagDistributionPreview tag={tag} colors={colors} />}
            skipWrapper
            maxWidth={360}
          >
            <TagBarHoverArea>
              <TagMiniBar aria-hidden="true">
                {barValues.map((value, index) => {
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
              </TagMiniBar>
            </TagBarHoverArea>
          </Tooltip>
        ) : (
          <Text size="xs" variant="muted">
            {t('—')}
          </Text>
        )}
      </Flex>
      <Flex align="baseline" justify="center">
        {hasValues && topValuePct !== null ? (
          <Text size="xs" variant="muted" style={{flexShrink: 0}}>
            {topValuePct}%
          </Text>
        ) : (
          <Text size="sm" variant="muted">
            {t('—')}
          </Text>
        )}
      </Flex>
      {hasValues ? (
        <Flex align="baseline" gap="xs" minWidth={0}>
          <Text size="sm" ellipsis>
            {topValue?.name || t('(empty)')}
          </Text>
        </Flex>
      ) : (
        <Flex align="baseline" gap="xs" minWidth={0}>
          <Text size="sm" variant="muted">
            {t('No values')}
          </Text>
        </Flex>
      )}
    </TagRow>
  );
}

export function ClusterDetailDrawer({cluster}: {cluster: ClusterSummary}) {
  const theme = useTheme();
  const organization = useOrganization();
  const clusterStats = useClusterStats(cluster.group_ids);

  const allTags = useMemo(() => {
    return [
      ...new Set([
        ...(cluster.error_type_tags ?? []),
        ...(cluster.code_area_tags ?? []),
        ...(cluster.service_tags ?? []),
      ]),
    ];
  }, [cluster.error_type_tags, cluster.code_area_tags, cluster.service_tags]);

  const relevancePercent = cluster.fixability_score
    ? Math.round(cluster.fixability_score * 100)
    : null;
  const groupListQueryParams = useMemo(
    () => ({
      query: `issue.id:[${cluster.group_ids.join(',')}]`,
      limit: 25,
    }),
    [cluster.group_ids]
  );
  const placeholderRows = Math.min(cluster.group_ids.length, 10);

  return (
    <Fragment>
      <DrawerHeader hideBar>
        <Flex justify="between" align="center" gap="md" flexGrow={1}>
          <NavigationCrumbs
            crumbs={[
              {label: t('Top Issues')},
              {
                label: (
                  <CrumbContainer>
                    <ShortId>{`CLUSTER-${cluster.cluster_id}`}</ShortId>
                  </CrumbContainer>
                ),
              },
            ]}
          />
          <Link
            to={`/organizations/${organization.slug}/issues/?query=issue.id:[${cluster.group_ids.join(',')}]`}
          >
            <Button size="xs">
              {t('View All Issues')} ({cluster.group_ids.length})
            </Button>
          </Link>
        </Flex>
      </DrawerHeader>
      <DrawerContentBody>
        <Flex direction="column" minWidth={0}>
          <Container padding="2xl" borderBottom="muted">
            <Flex direction="column" gap="xs" style={{marginBottom: theme.space.lg}}>
              <Heading as="h2" size="lg">
                {renderWithInlineCode(cluster.title)}
              </Heading>
              <Text size="sm" variant="muted">
                {cluster.impact ? `${cluster.impact} ` : ''}
                [CLUSTER-{cluster.cluster_id}]
              </Text>
            </Flex>
            <Flex wrap="wrap" align="center" gap="md">
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

            <Flex wrap="wrap" gap="lg" style={{marginBottom: theme.space.lg}}>
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
          </Container>

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

            {cluster.explorer_run_id && (
              <Disclosure size="sm">
                <Disclosure.Title>{t('Suggested Code Change')}</Disclosure.Title>
                <Disclosure.Content>
                  <SuggestedCodeChange runId={cluster.explorer_run_id} />
                </Disclosure.Content>
              </Disclosure>
            )}

            <Disclosure size="sm">
              <Disclosure.Title>
                {t('Issues in Cluster (%s)', cluster.group_ids.length)}
              </Disclosure.Title>
              <Disclosure.Content>
                <GroupList
                  queryParams={groupListQueryParams}
                  canSelectGroups={false}
                  withChart={false}
                  withPagination={false}
                  source="top-issues-cluster-drawer"
                  numPlaceholderRows={placeholderRows}
                />
              </Disclosure.Content>
            </Disclosure>
          </Grid>
        </Flex>
      </DrawerContentBody>
    </Fragment>
  );
}

const TagPill = styled('span')`
  display: inline-block;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 20px;
`;

const DrawerContentBody = styled(DrawerBody)`
  padding: 0;
`;

const TagsTableHeader = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const DenseTagsGrid = styled('div')`
  display: contents;
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

const DenseTagSegment = styled('div')`
  height: 100%;
  min-width: 2px;
`;

const TagMiniBar = styled('div')`
  display: flex;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: ${p => p.theme.backgroundSecondary};
  box-shadow: inset 0 0 0 1px ${p => p.theme.translucentBorder};
`;

const TagBarHoverArea = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: ${p => p.theme.space.xs} 0;
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
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;
