import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {inlineCodeStyles} from '@sentry/scraps/code';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {bulkDelete, bulkUpdate, mergeGroups} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {AnalyticsArea, useAnalyticsArea} from 'sentry/components/analyticsArea';
import {NavigationCrumbs} from 'sentry/components/events/eventDrawer';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {IssueStreamHeaderLabel} from 'sentry/components/IssueStreamHeaderLabel';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
  LoadingStreamGroup,
  StreamGroup,
} from 'sentry/components/stream/group';
import {IconChevron, IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {uniq} from 'sentry/utils/array/uniq';
import {MarkedText} from 'sentry/utils/marked/markedText';
import type {IndexedMembersByProject} from 'sentry/utils/members/shared';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActionSet} from 'sentry/views/issueList/actions/actionSet';
import {COLUMN_BREAKPOINTS, ConfirmAction} from 'sentry/views/issueList/actions/utils';
import {
  IssueSelectionProvider,
  useIssueSelectionActions,
  useIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';
import {SupergroupFeedback} from 'sentry/views/issueList/supergroups/supergroupFeedback';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
const DRAWER_COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'assignee',
  'firstSeen',
  'lastSeen',
];

interface SupergroupDetailDrawerProps {
  supergroup: SupergroupDetail;
  filterWithCurrentSearch?: boolean;
  memberList?: IndexedMembersByProject;
}

export function SupergroupDetailDrawer({
  supergroup,
  memberList,
  filterWithCurrentSearch,
}: SupergroupDetailDrawerProps) {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('supergroup.drawer_opened', {
      supergroup_id: supergroup.id,
      organization,
    });
  }, [supergroup.id, organization]);

  return (
    <AnalyticsArea name="supergroup_drawer">
      <DrawerHeader hideBar>
        <Flex justify="between" align="center" gap="md" flexGrow={1}>
          <Flex align="center" gap="sm">
            <NavigationCrumbs crumbs={[{label: t('Issue Groups')}]} />
            <Badge variant="experimental">{t('Experimental')}</Badge>
          </Flex>
          <FeedbackButton
            size="xs"
            feedbackOptions={{
              formTitle: t('Give feedback on Issue Groups'),
              messagePlaceholder: t('How can we make Issue Groups better for you?'),
              tags: {
                ['feedback.source']: 'supergroup_drawer',
              },
            }}
            tooltipProps={{title: t('Give feedback on Issue Groups')}}
          />
        </Flex>
      </DrawerHeader>
      <DrawerContentBody>
        <SupergroupFeedback supergroupId={supergroup.id} />
        <Container padding="2xl" borderBottom="muted">
          <Stack gap="lg">
            <Heading as="h2" size="lg">
              <StyledMarkedText text={supergroup.title} inline as="span" />
            </Heading>

            {supergroup.summary && (
              <Text size="md">
                <StyledMarkedText text={supergroup.summary} inline as="span" />
              </Text>
            )}

            <Stack gap="sm">
              {supergroup.error_type && (
                <Flex gap="xs">
                  <Text size="sm" variant="muted">
                    {t('Error')}
                  </Text>
                  <Text size="sm">{supergroup.error_type}</Text>
                </Flex>
              )}
              {supergroup.code_area && (
                <Flex gap="xs">
                  <Text size="sm" variant="muted">
                    {t('Location')}
                  </Text>
                  <Text size="sm">{supergroup.code_area}</Text>
                </Flex>
              )}
            </Stack>
          </Stack>
        </Container>

        {supergroup.group_ids.length > 0 && (
          <Container padding="xl 2xl">
            <SupergroupIssueList
              groupIds={supergroup.group_ids}
              memberList={memberList}
              filterWithCurrentSearch={filterWithCurrentSearch}
            />
          </Container>
        )}
      </DrawerContentBody>
    </AnalyticsArea>
  );
}

const PAGE_SIZE = 25;

/**
 * How many items we're willing to hoist. Doubles as the inline-id cap (members
 * we'll embed in `issue.id:[…]` before the URL gets too big) and the stream-
 * scan window (top stream results we inspect when the id list is too big to
 * inline).
 */
const HOIST_LIMIT = 50;

function SupergroupIssueList({
  groupIds,
  memberList,
  filterWithCurrentSearch,
}: {
  groupIds: number[];
  filterWithCurrentSearch?: boolean;
  memberList?: IndexedMembersByProject;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const [page, setPage] = useState(0);

  const {
    query: searchQuery,
    project,
    environment,
    statsPeriod,
    start,
    end,
  } = location.query;
  const query = typeof searchQuery === 'string' ? searchQuery : '';

  const inlineIdListFits = groupIds.length <= HOIST_LIMIT;

  const {data: matchedGroups, isPending: matchedPending} = useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        project,
        environment,
        statsPeriod,
        start,
        end,
        query: inlineIdListFits ? `${query} issue.id:[${groupIds.join(',')}]` : query,
        per_page: HOIST_LIMIT,
      },
      staleTime: 30_000,
    }),
    enabled: !!filterWithCurrentSearch && groupIds.length > 0,
  });

  const matchedIds = useMemo(() => {
    if (!matchedGroups) {
      return new Set<string>();
    }
    if (inlineIdListFits) {
      return new Set(matchedGroups.map(g => g.id));
    }
    const memberSet = new Set(groupIds.map(String));
    return new Set(matchedGroups.map(g => g.id).filter(id => memberSet.has(id)));
  }, [matchedGroups, inlineIdListFits, groupIds]);

  // When filtering with the stream query, wait for the match so the IDs we
  // fetch reflect the hoisted ordering.
  const pageFetchReady = !filterWithCurrentSearch || !matchedPending;
  const sortedGroupIds = useMemo(
    () =>
      filterWithCurrentSearch
        ? [...groupIds].sort(
            (a, b) =>
              Number(matchedIds.has(String(b))) - Number(matchedIds.has(String(a)))
          )
        : groupIds,
    [filterWithCurrentSearch, groupIds, matchedIds]
  );

  const totalPages = Math.max(1, Math.ceil(sortedGroupIds.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleIds = sortedGroupIds.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE
  );

  const {data: allGroups, isPending: allPending} = useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        group: visibleIds.map(String),
        project: ALL_ACCESS_PROJECTS,
      },
      staleTime: 30_000,
    }),
    enabled: pageFetchReady,
  });

  if (allPending || (filterWithCurrentSearch && matchedPending)) {
    return (
      <Fragment>
        {filterWithCurrentSearch && (
          <Flex align="center" gap="xs" padding="0 0 md 0">
            <IconFilter size="xs" variant="accent" />
            <Text size="sm" variant="muted">
              {t('Matches current filters')}
            </Text>
          </Flex>
        )}
        <PanelContainer>
          <LoadingHeader>
            <IssueLabel hideDivider>{t('Issue')}</IssueLabel>
            <DrawerColumnHeaders />
          </LoadingHeader>
          <PanelBody>
            {visibleIds.map(id => (
              <LoadingStreamGroup key={id} withChart withColumns={DRAWER_COLUMNS} />
            ))}
          </PanelBody>
        </PanelContainer>
      </Fragment>
    );
  }

  const groupMap = new Map(allGroups?.map(g => [g.id, g]));
  const sortedGroups = visibleIds
    .map(id => groupMap.get(String(id)))
    .filter((g): g is Group => g !== undefined)
    .sort((a, b) => Number(matchedIds.has(b.id)) - Number(matchedIds.has(a.id)));
  const visibleGroupIds = sortedGroups.map(g => g.id);

  return (
    <Fragment>
      {filterWithCurrentSearch && (
        <Flex align="center" gap="xs" padding="0 0 md 0">
          <IconFilter size="xs" variant="accent" />
          <Text size="sm" variant="muted">
            {t('Matches current filters')}
          </Text>
        </Flex>
      )}
      <IssueSelectionProvider visibleGroupIds={visibleGroupIds}>
        <PanelContainer>
          <DrawerActionsBar groupIds={visibleGroupIds} />
          <PanelBody>
            {sortedGroups.map(group => {
              const members = memberList?.[group.project?.slug]
                ? memberList[group.project.slug]
                : undefined;
              return (
                <IssueRow key={group.id}>
                  {matchedIds.has(group.id) && (
                    <MatchedIndicator>
                      <IconFilter size="xs" />
                    </MatchedIndicator>
                  )}
                  <StreamGroup
                    group={group}
                    canSelect
                    withChart
                    withColumns={DRAWER_COLUMNS}
                    memberList={members}
                    statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
                    source="supergroup-drawer"
                  />
                </IssueRow>
              );
            })}
          </PanelBody>
        </PanelContainer>
      </IssueSelectionProvider>
      {totalPages > 1 && (
        <Flex justify="end" align="center" gap="sm" padding="md 0">
          <Text size="sm" variant="muted">
            {`${safePage * PAGE_SIZE + 1}-${Math.min((safePage + 1) * PAGE_SIZE, sortedGroupIds.length)} of ${sortedGroupIds.length}`}
          </Text>
          <Flex gap="xs">
            <Button
              size="xs"
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            />
            <Button
              size="xs"
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
            />
          </Flex>
        </Flex>
      )}
    </Fragment>
  );
}

function DrawerActionsBar({groupIds}: {groupIds: string[]}) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const area = useAnalyticsArea();
  const {selection} = usePageFilters();
  const {toggleSelectAllVisible, deselectAll} = useIssueSelectionActions();
  const {pageSelected, anySelected, multiSelected, selectedIdsSet} =
    useIssueSelectionSummary();

  const selectedProjectSlug = useMemo(() => {
    const projects = [...selectedIdsSet]
      .map(id => GroupStore.get(id))
      .filter((group): group is Group => !!group?.project)
      .map(group => group.project.slug);
    const uniqProjects = uniq(projects);
    return uniqProjects.length === 1 ? uniqProjects[0] : undefined;
  }, [selectedIdsSet]);

  const handleUpdate = useCallback(
    (data: IssueUpdateData) => {
      const itemIds = [...selectedIdsSet];
      if (itemIds.length) {
        addLoadingMessage(t('Saving changes\u2026'));
      }
      bulkUpdate(
        api,
        {
          orgId: organization.slug,
          itemIds,
          data,
          project: selection.projects,
          environment: selection.environments,
          ...selection.datetime,
        },
        {
          success: () => {
            clearIndicators();
            for (const itemId of itemIds) {
              queryClient.invalidateQueries({
                queryKey: [`/organizations/${organization.slug}/issues/${itemId}/`],
                exact: false,
              });
            }
          },
          error: () => {
            clearIndicators();
            addErrorMessage(t('Unable to update issues'));
          },
        }
      );
      deselectAll();
    },
    [api, organization.slug, selectedIdsSet, selection, queryClient, deselectAll]
  );

  const handleDelete = useCallback(() => {
    const itemIds = [...selectedIdsSet];
    bulkDelete(
      api,
      {
        orgId: organization.slug,
        itemIds,
        project: selection.projects,
        environment: selection.environments,
        ...selection.datetime,
      },
      {}
    );
    deselectAll();
  }, [api, organization.slug, selectedIdsSet, selection, deselectAll]);

  const handleMerge = useCallback(() => {
    const itemIds = [...selectedIdsSet];
    mergeGroups(
      api,
      {
        orgId: organization.slug,
        itemIds,
        project: selection.projects,
        environment: selection.environments,
        ...selection.datetime,
      },
      {}
    );
    trackAnalytics('issues_stream.merged', {
      organization,
      project_id: undefined,
      platform: undefined,
      items_merged: itemIds.length,
      area,
    });
    deselectAll();
  }, [api, area, organization, selectedIdsSet, selection, deselectAll]);

  const onShouldConfirm = useCallback(
    (action: ConfirmAction) => {
      switch (action) {
        case ConfirmAction.RESOLVE:
        case ConfirmAction.UNRESOLVE:
        case ConfirmAction.ARCHIVE:
        case ConfirmAction.SET_PRIORITY:
        case ConfirmAction.UNBOOKMARK:
          return pageSelected && selectedIdsSet.size > 1;
        case ConfirmAction.BOOKMARK:
          return selectedIdsSet.size > 1;
        case ConfirmAction.MERGE:
        case ConfirmAction.DELETE:
        default:
          return true;
      }
    },
    [pageSelected, selectedIdsSet.size]
  );

  return (
    <ActionsBarContainer>
      <Checkbox
        onChange={toggleSelectAllVisible}
        checked={pageSelected || (anySelected ? 'indeterminate' : false)}
        aria-label={pageSelected ? t('Deselect all') : t('Select all')}
      />
      {anySelected ? (
        <HeaderButtonsWrapper>
          <ActionSet
            queryCount={groupIds.length}
            query=""
            issues={selectedIdsSet}
            allInQuerySelected={false}
            anySelected={anySelected}
            multiSelected={multiSelected}
            selectedProjectSlug={selectedProjectSlug}
            onShouldConfirm={onShouldConfirm}
            onDelete={handleDelete}
            onMerge={handleMerge}
            onUpdate={handleUpdate}
          />
        </HeaderButtonsWrapper>
      ) : (
        <Fragment>
          <IssueLabel hideDivider>{t('Issue')}</IssueLabel>
          <DrawerColumnHeaders />
        </Fragment>
      )}
    </ActionsBarContainer>
  );
}

function DrawerColumnHeaders() {
  return (
    <Fragment>
      {DRAWER_COLUMNS.includes('lastSeen') && (
        <ColumnLabel breakpoint={COLUMN_BREAKPOINTS.LAST_SEEN} align="right">
          {t('Last Seen')}
        </ColumnLabel>
      )}
      {DRAWER_COLUMNS.includes('firstSeen') && (
        <ColumnLabel breakpoint={COLUMN_BREAKPOINTS.FIRST_SEEN} align="right">
          {t('Age')}
        </ColumnLabel>
      )}
      {DRAWER_COLUMNS.includes('graph') && (
        <GraphColumnLabel breakpoint={COLUMN_BREAKPOINTS.TREND}>
          {t('Graph')}
        </GraphColumnLabel>
      )}
      {DRAWER_COLUMNS.includes('event') && (
        <ColumnLabel breakpoint={COLUMN_BREAKPOINTS.EVENTS} align="right">
          {t('Events')}
        </ColumnLabel>
      )}
      {DRAWER_COLUMNS.includes('users') && (
        <ColumnLabel breakpoint={COLUMN_BREAKPOINTS.USERS} align="right">
          {t('Users')}
        </ColumnLabel>
      )}
      {DRAWER_COLUMNS.includes('assignee') && (
        <AssigneeColumnLabel breakpoint={COLUMN_BREAKPOINTS.ASSIGNEE} align="right">
          {t('Assignee')}
        </AssigneeColumnLabel>
      )}
    </Fragment>
  );
}

const ActionsBarContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  height: 36px;
  padding: 0;
  padding-left: ${p => p.theme.space.xl};
  align-items: center;
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const HeaderButtonsWrapper = styled('div')`
  flex: 1;
  display: flex;
  gap: ${p => p.theme.space.xs};
  white-space: nowrap;
`;

const IssueLabel = styled(IssueStreamHeaderLabel)`
  flex: 1;
`;

const ColumnLabel = styled(IssueStreamHeaderLabel)`
  width: 60px;
`;

const GraphColumnLabel = styled(IssueStreamHeaderLabel)`
  width: 175px;
`;

const AssigneeColumnLabel = styled(IssueStreamHeaderLabel)`
  width: 66px;
`;

const LoadingHeader = styled('div')`
  display: flex;
  min-height: 36px;
  padding: ${p => p.theme.space.xs} 0;
  padding-left: ${p => p.theme.space.xl};
  align-items: center;
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const DrawerContentBody = styled(DrawerBody)`
  padding: 0;
`;

const PanelContainer = styled(Panel)`
  container-type: inline-size;
`;

const MatchedIndicator = styled('div')`
  position: absolute;
  top: 32px;
  left: 18px;
  z-index: 2;
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
  pointer-events: none;
`;

const IssueRow = styled('div')`
  position: relative;

  /* On hover or when checkbox is checked, hide the filter icon so the checkbox shows through */
  &:hover,
  &:has(input:checked) {
    ${MatchedIndicator} {
      display: none;
    }
  }
`;

const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;
