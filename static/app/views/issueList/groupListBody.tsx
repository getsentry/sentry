import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LoadingError} from 'sentry/components/loadingError';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {LoadingStreamGroup, StreamGroup} from 'sentry/components/stream/group';
import {SupergroupChildList} from 'sentry/components/stream/supergroups/supergroupChildList';
import {SupergroupRow} from 'sentry/components/stream/supergroups/supergroupRow';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import {useApi} from 'sentry/utils/useApi';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';
import type {SupergroupLookup} from 'sentry/views/issueList/supergroups/useSuperGroups';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

import {NoGroupsHandler} from './noGroupsHandler';
import {SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY} from './utils';

type GroupListBodyProps = {
  displayReprocessingLayout: boolean;
  error: string | null;
  groupIds: string[];
  groupStatsPeriod: string;
  loading: boolean;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  pageSize: number;
  query: string;
  refetchGroups: () => void;
  selectedProjectIds: number[];
  supergroupLookup?: SupergroupLookup;
};

type GroupListProps = {
  displayReprocessingLayout: boolean;
  groupIds: string[];
  groupStatsPeriod: string;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
  supergroupLookup?: SupergroupLookup;
};

const COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
  'lastTriggered',
];

type RenderItem =
  | {id: string; type: 'issue'}
  | {matchingIds: string[]; supergroup: SupergroupDetail; type: 'supergroup'};

function LoadingSkeleton({
  pageSize,
  displayReprocessingLayout,
}: {
  displayReprocessingLayout: boolean;
  pageSize: number;
}) {
  return (
    <PanelBody>
      {Array.from({length: pageSize}).map((_, index) => (
        <LoadingStreamGroup
          key={`loading-group-${index}`}
          displayReprocessingLayout={displayReprocessingLayout}
          withColumns={COLUMNS}
        />
      ))}
    </PanelBody>
  );
}

export function GroupListBody({
  groupIds,
  memberList,
  query,
  displayReprocessingLayout,
  groupStatsPeriod,
  loading,
  error,
  refetchGroups,
  selectedProjectIds,
  pageSize,
  onActionTaken,
  supergroupLookup,
}: GroupListBodyProps) {
  const api = useApi();
  const organization = useOrganization();

  if (loading) {
    return (
      <LoadingSkeleton
        displayReprocessingLayout={displayReprocessingLayout}
        pageSize={pageSize}
      />
    );
  }

  if (error) {
    return <LoadingError message={error} onRetry={refetchGroups} />;
  }

  if (!groupIds.length) {
    return (
      <NoGroupsHandler
        api={api}
        organization={organization}
        query={query}
        selectedProjectIds={selectedProjectIds}
        groupIds={groupIds}
      />
    );
  }

  return (
    <GroupList
      groupIds={groupIds}
      memberList={memberList}
      query={query}
      displayReprocessingLayout={displayReprocessingLayout}
      groupStatsPeriod={groupStatsPeriod}
      onActionTaken={onActionTaken}
      supergroupLookup={supergroupLookup}
    />
  );
}

function buildRenderItems(
  groupIds: string[],
  getSuperGroupForIssue: (id: string) => SupergroupDetail | null | undefined,
  enabled: boolean
): RenderItem[] {
  if (!enabled) {
    return groupIds.map(id => ({type: 'issue' as const, id}));
  }

  const seen = new Map<number, string[]>();
  const items: RenderItem[] = [];

  for (const id of groupIds) {
    const sg = getSuperGroupForIssue(id);
    if (sg && sg.group_ids.length > 1) {
      const existing = seen.get(sg.id);
      if (existing) {
        existing.push(id);
      } else {
        const matchingIds = [id];
        seen.set(sg.id, matchingIds);
        items.push({type: 'supergroup', supergroup: sg, matchingIds});
      }
    } else {
      items.push({type: 'issue', id});
    }
  }

  return items;
}

function GroupList({
  groupIds,
  memberList,
  query,
  displayReprocessingLayout,
  groupStatsPeriod,
  onActionTaken,
  supergroupLookup,
}: GroupListProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const [isSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );
  const [collapsedSupergroupIds, setCollapsedSupergroupIds] = useState<Set<number>>(
    new Set()
  );
  const topIssue = groupIds[0];
  const selectDisabled = useMedia(
    `(width < ${isSavedSearchesOpen ? theme.breakpoints.xl : theme.breakpoints.md})`
  );

  const handleToggleExpand = useCallback((supergroupId: number) => {
    setCollapsedSupergroupIds(prev => {
      const next = new Set(prev);
      if (next.has(supergroupId)) {
        next.delete(supergroupId);
      } else {
        next.add(supergroupId);
      }
      return next;
    });
  }, []);

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  const renderItems = useMemo(
    () =>
      buildRenderItems(
        groupIds,
        (id: string) => supergroupLookup?.[id] ?? null,
        hasTopIssuesUI
      ),
    [groupIds, supergroupLookup, hasTopIssuesUI]
  );

  const renderStreamGroup = (id: string, columns: GroupListColumn[]) => {
    const group = GroupStore.get(id) as Group | undefined;
    if (!group) {
      return null;
    }
    return (
      <StreamGroup
        key={id}
        group={group}
        statsPeriod={groupStatsPeriod}
        query={query}
        hasGuideAnchor={id === topIssue}
        memberList={group.project ? memberList[group.project.slug] : undefined}
        displayReprocessingLayout={displayReprocessingLayout}
        useFilteredStats
        canSelect={!selectDisabled}
        onPriorityChange={priority => onActionTaken([id], {priority})}
        withColumns={columns}
      />
    );
  };

  return (
    <PanelBody>
      {renderItems.map(item => {
        if (item.type === 'issue') {
          return renderStreamGroup(item.id, COLUMNS);
        }

        const {supergroup, matchingIds} = item;
        const expanded = collapsedSupergroupIds.has(supergroup.id);

        return (
          <Fragment key={`sg-${supergroup.id}`}>
            <SupergroupRow
              supergroup={supergroup}
              expanded={expanded}
              onToggle={() => handleToggleExpand(supergroup.id)}
            />
            {expanded && (
              <Container background="secondary">
                <SupergroupChildList
                  supergroup={supergroup}
                  memberList={memberList}
                  query={query}
                  knownMatchIds={matchingIds}
                />
              </Container>
            )}
          </Fragment>
        );
      })}
    </PanelBody>
  );
}
