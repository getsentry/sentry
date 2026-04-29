import {useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {ActorAvatar, TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
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
import {defined} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {useUser} from 'sentry/utils/useUser';
import {
  useIssueSelectionActions,
  useIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

interface IssueListBulkCommandPaletteActionsProps {
  groupIds: string[];
  query: string;
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

  function getSelectedProjectIds(selectedGroupIds: string[] | undefined) {
    if (!selectedGroupIds) {
      return selection.projects;
    }
    const groups = selectedGroupIds.map(id => GroupStore.get(id));
    const projectIds = new Set(groups.map(group => group?.project?.id).filter(defined));
    if (projectIds.size === 1) {
      return [...projectIds];
    }
    return selection.projects;
  }

  function performBulkUpdate(
    data: IssueUpdateData | Record<string, unknown>,
    onSuccess?: (itemIds: string[] | undefined) => void
  ) {
    const itemIds = getSelectedIds();
    const projectConstraints = {project: getSelectedProjectIds(itemIds)};

    if (itemIds?.length) {
      addLoadingMessage(t('Saving changes…'));
    }

    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        itemIds,
        data,
        query,
        environment: selection.environments,
        failSilently: true,
        ...projectConstraints,
        ...selection.datetime,
      },
      {
        success: () => {
          clearIndicators();
          onSuccess?.(itemIds);
          invalidateIssueQueries(itemIds);
        },
        error: () => {
          clearIndicators();
          addErrorMessage(t('Unable to update issues'));
        },
      }
    );

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

  function invalidateIssueQueries(itemIds: string[] | undefined) {
    if (itemIds?.length) {
      for (const itemId of itemIds) {
        queryClient.invalidateQueries({
          queryKey: [`/organizations/${organization.slug}/issues/${itemId}/`],
          exact: false,
        });
      }
    } else {
      queryClient.invalidateQueries({
        predicate: apiQuery => {
          const queryKey = safeParseQueryKey(apiQuery.queryKey);
          if (!queryKey) {
            return false;
          }
          return queryKey.url.startsWith(`/organizations/${organization.slug}/issues/`);
        },
      });
    }
  }

  const selectedIssueIds = useMemo(() => {
    const ids = selectedIssues.map(issue => `#${issue.shortId}`);
    if (ids.length <= 3) {
      return ids.join(', ');
    }
    return `${ids.slice(0, 3).join(', ')}, …`;
  }, [selectedIssues]);

  if (!anySelected) {
    return null;
  }

  return (
    <CommandPaletteSlot name="task">
      <CMDKAction
        display={{
          label: `${tn('%s Selected Issue', '%s Selected Issues', numIssues)} (${selectedIssueIds})`,
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
