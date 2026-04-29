import {useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {ActorAvatar, TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';

import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {IconCheckmark, IconClock, IconIssues, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import type {PageFilters} from 'sentry/types/core';
import type {BaseGroup} from 'sentry/types/group';
import {GroupStatus, GroupSubstatus, PriorityLevel} from 'sentry/types/group';
import type {Member} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {useUser} from 'sentry/utils/useUser';
import {
  BULK_LIMIT,
  BULK_LIMIT_STR,
  invalidateIssueQueries,
  performBulkUpdate as performSharedBulkUpdate,
} from 'sentry/views/issueList/actions/utils';
import {
  useIssueSelectionActions,
  useIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

interface IssueListBulkCommandPaletteActionsProps {
  groupIds: string[];
  query: string;
  queryCount: number;
  selection: PageFilters;
  onActionTaken?: (itemIds: string[], data: IssueUpdateData) => void;
}

function useOrgMembers() {
  const organization = useOrganization();
  return useQuery({
    ...apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/users/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 30_000,
    }),
    select: data =>
      data.json.filter(
        (m): m is Member & {user: NonNullable<Member['user']>} => m.user !== null
      ),
  });
}

function AssignActions({
  onBulkUpdate,
}: {
  onBulkUpdate: (data: Record<string, unknown>) => void;
}) {
  const user = useUser();
  const {teams} = useTeams({provideUserTeams: true});
  const {data: members = []} = useOrgMembers();

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.slug.localeCompare(b.slug)),
    [teams]
  );

  const assignableMembers = useMemo(
    () => members.filter(m => m.user.id !== user?.id),
    [members, user?.id]
  );

  return (
    <CMDKAction
      display={{label: t('Assign to'), icon: <IconUser />}}
      keywords={['assign', 'owner', 'assignee']}
      prompt={t('Search assignees...')}
    >
      {user && (
        <CMDKAction
          display={{
            label: t('Assign to me'),
            icon: <UserAvatar user={user} size={16} hasTooltip={false} />,
          }}
          keywords={['mine', 'my issues', 'me']}
          onAction={() => onBulkUpdate({assignedTo: `user:${user.id}`})}
        />
      )}
      <CMDKAction
        display={{label: t('Unassign'), icon: <IconUser />}}
        keywords={['unassign', 'clear', 'remove assignee', 'nobody']}
        onAction={() => onBulkUpdate({assignedTo: ''})}
      />
      {sortedTeams.map(team => (
        <CMDKAction
          key={`team-${team.id}`}
          display={{
            label: `#${team.slug}`,
            icon: <TeamAvatar team={team} size={16} hasTooltip={false} />,
          }}
          onAction={() => onBulkUpdate({assignedTo: `team:${team.id}`})}
        />
      ))}
      {assignableMembers.map(m => (
        <CMDKAction
          key={`member-${m.user.id}`}
          display={{
            label: m.user.name || m.user.email,
            icon: (
              <ActorAvatar
                actor={{
                  id: m.user.id,
                  name: m.user.name || m.user.email,
                  type: 'user',
                }}
                size={16}
                hasTooltip={false}
              />
            ),
          }}
          onAction={() => onBulkUpdate({assignedTo: `user:${m.user.id}`})}
        />
      ))}
    </CMDKAction>
  );
}

function PriorityActions({onUpdate}: {onUpdate: (data: IssueUpdateData) => void}) {
  return (
    <CMDKAction
      display={{label: t('Set Priority'), icon: <IconCellSignal bars={2} />}}
      keywords={['priority', 'urgency', 'critical', 'high', 'medium', 'low']}
    >
      <CMDKAction
        display={{label: t('High'), icon: <IconCellSignal bars={3} />}}
        onAction={() => onUpdate({priority: PriorityLevel.HIGH})}
      />
      <CMDKAction
        display={{label: t('Medium'), icon: <IconCellSignal bars={2} />}}
        onAction={() => onUpdate({priority: PriorityLevel.MEDIUM})}
      />
      <CMDKAction
        display={{label: t('Low'), icon: <IconCellSignal bars={1} />}}
        onAction={() => onUpdate({priority: PriorityLevel.LOW})}
      />
    </CMDKAction>
  );
}

export function IssueListBulkCommandPaletteActions({
  query,
  queryCount,
  selection,
  groupIds,
  onActionTaken,
}: IssueListBulkCommandPaletteActionsProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {anySelected, selectedIdsSet, allInQuerySelected} = useIssueSelectionSummary();
  const {deselectAll} = useIssueSelectionActions();

  const numIssues = selectedIdsSet.size;

  const selectedIssues = useMemo(
    () =>
      [...selectedIdsSet]
        .map(issueId => GroupStore.get(issueId))
        .filter((issue): issue is BaseGroup => !!issue),
    [selectedIdsSet]
  );

  const canResolve = selectedIssues.some(issue => issue.status !== GroupStatus.RESOLVED);
  const canArchive = selectedIssues.some(issue => issue.status !== GroupStatus.IGNORED);

  function getSelectedIds(): string[] | undefined {
    return allInQuerySelected
      ? undefined
      : groupIds.filter(itemId => selectedIdsSet.has(itemId));
  }

  function performBulkUpdate(
    data: IssueUpdateData | Record<string, unknown>,
    onSuccess?: (itemIds: string[] | undefined) => void
  ) {
    const itemIds = getSelectedIds();
    performSharedBulkUpdate({
      api,
      data,
      itemIds,
      organizationSlug: organization.slug,
      query,
      selection,
      onSuccess: updatedItemIds => {
        onSuccess?.(updatedItemIds);
        invalidateIssueQueries({
          itemIds: updatedItemIds,
          organizationSlug: organization.slug,
          queryClient,
        });
      },
    });

    deselectAll();
  }

  function handleUpdate(data: IssueUpdateData) {
    performBulkUpdate(data, itemIds => {
      onActionTaken?.(itemIds ?? [], data);
    });
  }

  function handleBulkUpdate(data: Record<string, unknown>) {
    performBulkUpdate(data);
  }
  const selectedIssueIds = useMemo(() => {
    const ids = selectedIssues.map(issue => `#${issue.shortId}`);
    if (ids.length <= 3) {
      return ids.join(', ');
    }
    return `${ids.slice(0, 3).join(', ')}, …`;
  }, [selectedIssues]);

  const label = useMemo(() => {
    if (allInQuerySelected) {
      if (queryCount >= BULK_LIMIT) {
        return t('First %s Issues Matching Search', BULK_LIMIT_STR);
      }
      return t('All %s Issues Matching Search', queryCount);
    }
    return `${tn('%s Selected Issue', '%s Selected Issues', numIssues)} (${selectedIssueIds})`;
  }, [allInQuerySelected, queryCount, numIssues, selectedIssueIds]);

  if (!anySelected) {
    return null;
  }

  return (
    <CommandPaletteSlot name="task">
      <CMDKAction
        display={{
          label,
          icon: <IconIssues />,
        }}
      >
        {canResolve && (
          <CMDKAction
            display={{label: t('Resolve'), icon: <IconCheckmark />}}
            keywords={['resolve', 'fix', 'done', 'close']}
            onAction={() =>
              handleUpdate({
                status: GroupStatus.RESOLVED,
                statusDetails: {},
                substatus: null,
              })
            }
          />
        )}
        {canArchive && (
          <CMDKAction
            display={{label: t('Archive'), icon: <IconClock />}}
            keywords={['archive', 'ignore', 'snooze', 'mute']}
            onAction={() =>
              handleUpdate({
                status: GroupStatus.IGNORED,
                statusDetails: {},
                substatus: GroupSubstatus.ARCHIVED_UNTIL_ESCALATING,
              })
            }
          />
        )}
        <PriorityActions onUpdate={handleUpdate} />
        <AssignActions onBulkUpdate={handleBulkUpdate} />
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
