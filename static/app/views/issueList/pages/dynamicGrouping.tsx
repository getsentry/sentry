import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {openConfirmModal} from 'sentry/components/confirm';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Disclosure} from 'sentry/components/core/disclosure';
import {Link} from 'sentry/components/core/link';
import {TextArea} from 'sentry/components/core/textarea';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import useDrawer from 'sentry/components/globalDrawer';
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
import {GroupStatus, GroupSubstatus} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeInteger} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {
  ClusterDetailDrawer,
  useClusterStats,
  type ClusterSummary,
} from 'sentry/views/issueList/pages/topIssuesDrawer';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';

const CLUSTERS_PER_PAGE = 20;

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

interface TopIssuesResponse {
  data: ClusterSummary[];
  last_updated?: string;
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
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
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

  const handleOpenDetails = useCallback(() => {
    navigate(
      {
        pathname: location.pathname,
        query: {...location.query, cluster: String(cluster.cluster_id)},
      },
      {preventScrollReset: true}
    );
  }, [navigate, location.pathname, location.query, cluster.cluster_id]);

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
      <Stack padding="2xl 2xl 0" gap="md">
        {cluster.impact && (
          <ClusterTitleLink
            to={{
              pathname: location.pathname,
              query: {...location.query, cluster: String(cluster.cluster_id)},
            }}
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
            <Flex wrap="wrap" gap="md">
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
            </Flex>
          )}
        <Flex justify="between" align="center" gap="xl">
          <ClusterStats>
            <Flex align="center" gap="xs">
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
            </Flex>
            <Flex align="center" gap="xs">
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
            </Flex>
          </ClusterStats>
          {!clusterStats.isPending &&
            (clusterStats.firstSeen || clusterStats.lastSeen) && (
              <TimeStats>
                {clusterStats.lastSeen && (
                  <Flex align="center" gap="xs">
                    <IconClock size="xs" variant="muted" />
                    <TimeSince
                      tooltipPrefix={t('Last Seen')}
                      date={clusterStats.lastSeen}
                      suffix={t('ago')}
                      unitStyle="short"
                    />
                  </Flex>
                )}
                {clusterStats.firstSeen && (
                  <Flex align="center" gap="xs">
                    <IconCalendar size="xs" variant="muted" />
                    <TimeSince
                      tooltipPrefix={t('First Seen')}
                      date={clusterStats.firstSeen}
                      suffix={t('old')}
                      unitStyle="short"
                    />
                  </Flex>
                )}
              </TimeStats>
            )}
        </Flex>
      </Stack>

      <CardBody>
        <Flex direction="column" gap="md">
          <Stack gap="xs">
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
          </Stack>
          {allTags.length > 0 && (
            <Flex wrap="wrap" gap="xs">
              {allTags.map(tag => (
                <TagPill key={tag}>{tag}</TagPill>
              ))}
            </Flex>
          )}
        </Flex>
      </CardBody>

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
            <Flex align="center" gap="2xs">
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
            </Flex>
          </Tooltip>
        )}
        <Flex align="center" gap="md">
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
          <Button size="sm" onClick={handleOpenDetails}>
            {t('View Details')}
          </Button>
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
        </Flex>
      </CardFooter>
    </CardContainer>
  );
}

function DynamicGrouping() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {openDrawer, isDrawerOpen} = useDrawer();
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
  const clusterData = useMemo(
    () => customClusterData ?? topIssuesResponse?.data ?? [],
    [customClusterData, topIssuesResponse?.data]
  );

  const selectedClusterId = decodeInteger(location.query.cluster);
  useEffect(() => {
    const selectedCluster = clusterData.find(
      cluster => cluster.cluster_id === selectedClusterId
    );
    if (selectedClusterId === undefined || !selectedCluster) {
      return;
    }

    openDrawer(() => <ClusterDetailDrawer cluster={selectedCluster} />, {
      ariaLabel: t('Top issue details'),
      drawerKey: 'top-issues-cluster-drawer',
      onClose: () => {
        navigate(
          {
            query: {...qs.parse(window.location.search), cluster: undefined},
          },
          {replace: true, preventScrollReset: true}
        );
      },
      shouldCloseOnLocationChange: nextLocation => !nextLocation.query.cluster,
    });
  }, [clusterData, openDrawer, navigate, isDrawerOpen, selectedClusterId]);

  // Extract all unique teams from the cluster data (for dev tools filter UI)
  const teamsInData = useMemo(() => {
    const teamMap = new Map<string, {id: string; name: string}>();
    for (const cluster of clusterData) {
      for (const entity of cluster.assignedTo ?? []) {
        if (entity.type === 'team' && !teamMap.has(entity.id)) {
          teamMap.set(entity.id, {id: entity.id, name: entity.name});
        }
      }
    }
    return Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clusterData]);

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

    return result.sort((a, b) => {
      // Sort clusters with >1 group before clusters with exactly 1 group
      const aHasMultipleGroups = a.group_ids.length > 1 ? 1 : 0;
      const bHasMultipleGroups = b.group_ids.length > 1 ? 1 : 0;
      if (bHasMultipleGroups !== aHasMultipleGroups) {
        return bHasMultipleGroups - aHasMultipleGroups;
      }
      // Within the same category, sort by fixability_score descending
      return (b.fixability_score ?? 0) - (a.fixability_score ?? 0);
    });
  }, [
    clusterData,
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
      <Stack minHeight="100%">
        <HeaderSection>
          <Flex
            align="center"
            gap="md"
            justify="between"
            style={{marginBottom: space(2)}}
          >
            <Flex align="center" gap="md">
              <ClickableHeading as="h1" onClick={() => setShowDevTools(prev => !prev)}>
                {t('Top Issues')}
              </ClickableHeading>
              <FeatureBadge type="experimental" />
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
          </Flex>

          <Flex gap="sm" align="center" style={{marginBottom: space(2)}}>
            <ProjectPageFilter resetParamsOnChange={['cluster']} />
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
                messagePlaceholder: t('What do you think about the Top Issues drawer?'),
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
              <Stack flex="1" gap="2xl" minWidth="0">
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
              </Stack>
              <Stack flex="1" gap="2xl" minWidth="0">
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
              </Stack>
            </CardsGrid>
          )}
          {hasMoreClusters && (
            <ShowMoreButton onClick={handleShowMore}>
              {t('Show more clusters (%s more)', remainingClusterCount)}
            </ShowMoreButton>
          )}
        </CardsSection>
      </Stack>
    </PageFiltersContainer>
  );
}

const HeaderSection = styled('div')`
  padding: ${space(4)} ${space(4)} ${space(3)};
  background: ${p => p.theme.tokens.background.secondary};
`;

const ClickableHeading = styled(Heading)`
  cursor: pointer;
  user-select: none;
`;

const CardsSection = styled('div')`
  flex: 1;
  padding: ${space(2)} ${space(4)} ${space(4)};
  background: ${p => p.theme.tokens.background.secondary};
`;

const CardsGrid = styled('div')`
  display: flex;
  gap: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    flex-direction: column;
  }
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
    border-color: ${p => p.theme.tokens.border.accent.moderate};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
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

const MoreProjectsCount = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${space(0.25)};
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
          background: ${p.theme.tokens.background.transparent.accent.muted};
          color: ${p.theme.tokens.content.accent};
        `;
      case 'yellow':
        return `
          background: ${p.theme.tokens.background.transparent.warning.muted};
          color: ${p.theme.tokens.content.warning};
        `;
      case 'red':
        return `
          background: ${p.theme.tokens.background.transparent.danger.muted};
          color: ${p.theme.tokens.content.danger};
        `;
      default:
        return '';
    }
  }}
`;

const CardBody = styled('div')`
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

const SeerButton = styled(Button)`
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
`;

const SeerDropdownTrigger = styled(Button)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
`;

const TagPill = styled('span')`
  display: inline-block;
  padding: ${space(0.25)} ${space(1)};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.secondary};
  background: ${p => p.theme.tokens.background.secondary};
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
  color: ${p =>
    p.disabled ? p.theme.tokens.content.disabled : p.theme.tokens.content.secondary};
`;

const ShowMoreButton = styled('button')`
  display: block;
  width: 100%;
  margin-top: ${space(3)};
  padding: ${space(2)} ${space(3)};
  background: ${p => p.theme.tokens.background.secondary};
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
    background: ${p => p.theme.tokens.background.tertiary};
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const JsonInputContainer = styled('div')`
  margin-bottom: ${space(2)};
  padding: ${space(2)};
  background: ${p => p.theme.tokens.background.secondary};
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
