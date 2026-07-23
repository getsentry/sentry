import {useQueryClient} from '@tanstack/react-query';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {GroupPriorityDropdown} from 'sentry/components/badge/groupPriority';
import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {t} from 'sentry/locale';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import {PriorityLevel, type Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';

type GroupDetailsPriorityProps = {
  group: Group;
  onChange?: (priority: PriorityLevel) => void;
};

export type GroupPriorityControlProps = {
  groupId: Group['id'];
  issueType: Group['issueType'];
  priority: PriorityLevel;
  priorityLockedAt: Group['priorityLockedAt'];
  projectId: Group['project']['id'];
  onChange?: (priority: PriorityLevel) => void;
  onChangeInitiated?: (priority: PriorityLevel) => void;
};

const PRIORITY_BARS: Record<PriorityLevel, 1 | 2 | 3> = {
  [PriorityLevel.HIGH]: 3,
  [PriorityLevel.MEDIUM]: 2,
  [PriorityLevel.LOW]: 1,
};

const getPriorityUpdateSuccessMessage = (priority: PriorityLevel) =>
  t('Priority updated to %s', priority);

function useChangePriority({
  groupId,
  priority,
  projectId,
  onChange,
  onChangeInitiated,
}: Pick<
  GroupPriorityControlProps,
  'groupId' | 'priority' | 'projectId' | 'onChange' | 'onChangeInitiated'
>) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return (nextPriority: PriorityLevel) => {
    if (nextPriority === priority) {
      return;
    }

    onChangeInitiated?.(nextPriority);

    addLoadingMessage(t('Saving changes\u2026'));
    IssueListCacheStore.reset();

    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        itemIds: [groupId],
        data: {priority: nextPriority},
        failSilently: true,
        project: [projectId],
      },
      {
        success: () => {
          queryClient.invalidateQueries({
            queryKey: groupQueryKey({
              organizationSlug: organization.slug,
              groupId,
            }),
          });
          clearIndicators();
          addSuccessMessage(getPriorityUpdateSuccessMessage(nextPriority));
          onChange?.(nextPriority);
        },
        error: () => {
          clearIndicators();
          addErrorMessage(t('Unable to update issue priority'));
        },
      }
    );
  };
}

function useTrackPriorityChange(group: Group) {
  const organization = useOrganization();

  return (nextPriority: PriorityLevel) => {
    trackAnalytics('issue_details.set_priority', {
      organization,
      ...getAnalyticsDataForGroup(group),
      from_priority: group.priority,
      to_priority: nextPriority,
    });
  };
}

export function GroupPriorityControl({
  groupId,
  issueType,
  priority,
  priorityLockedAt,
  projectId,
  onChange,
  onChangeInitiated,
}: GroupPriorityControlProps) {
  const onChangePriority = useChangePriority({
    groupId,
    priority,
    projectId,
    onChange,
    onChangeInitiated,
  });

  // We can assume that when there is not `priorityLockedAt`, there were no
  // user edits to the priority.
  const lastEditedBy = priorityLockedAt ? undefined : 'system';

  return (
    <GroupPriorityDropdown
      disabled={issueType === 'metric_issue'}
      groupId={groupId}
      onChange={onChangePriority}
      value={priority}
      lastEditedBy={lastEditedBy}
    />
  );
}

export function GroupPriority({group, onChange}: GroupDetailsPriorityProps) {
  const onChangeInitiated = useTrackPriorityChange(group);

  return (
    <GroupPriorityControl
      groupId={group.id}
      issueType={group.issueType}
      priority={group.priority ?? PriorityLevel.MEDIUM}
      priorityLockedAt={group.priorityLockedAt}
      projectId={group.project.id}
      onChange={onChange}
      onChangeInitiated={onChangeInitiated}
    />
  );
}

export function GroupPriorityCommandPaletteAction({
  group,
}: Pick<GroupDetailsPriorityProps, 'group'>) {
  const priority = group.priority ?? PriorityLevel.MEDIUM;
  const onChangeInitiated = useTrackPriorityChange(group);
  const onChangePriority = useChangePriority({
    groupId: group.id,
    priority,
    projectId: group.project.id,
    onChangeInitiated,
  });

  return (
    <CMDKAction
      display={{
        label: t('Set Priority'),
        icon: <IconCellSignal bars={PRIORITY_BARS[priority]} />,
      }}
    >
      <CMDKAction
        display={{label: t('High'), icon: <IconCellSignal bars={3} />}}
        onAction={() => onChangePriority(PriorityLevel.HIGH)}
      />
      <CMDKAction
        display={{label: t('Medium'), icon: <IconCellSignal bars={2} />}}
        onAction={() => onChangePriority(PriorityLevel.MEDIUM)}
      />
      <CMDKAction
        display={{label: t('Low'), icon: <IconCellSignal bars={1} />}}
        onAction={() => onChangePriority(PriorityLevel.LOW)}
      />
    </CMDKAction>
  );
}
