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

type GroupDetailsPriorityProps = {
  group: Group;
  onChange?: (priority: PriorityLevel) => void;
};

const PRIORITY_BARS: Record<PriorityLevel, 1 | 2 | 3> = {
  [PriorityLevel.HIGH]: 3,
  [PriorityLevel.MEDIUM]: 2,
  [PriorityLevel.LOW]: 1,
};

const getPriorityUpdateSuccessMessage = (priority: PriorityLevel) =>
  t('Priority updated to %s', priority);

function useChangePriority(group: Group, onChange?: (priority: PriorityLevel) => void) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();

  return (nextPriority: PriorityLevel) => {
    if (nextPriority === group.priority) {
      return;
    }

    trackAnalytics('issue_details.set_priority', {
      organization,
      ...getAnalyticsDataForGroup(group),
      from_priority: group.priority,
      to_priority: nextPriority,
    });

    addLoadingMessage(t('Saving changes\u2026'));
    IssueListCacheStore.reset();

    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        itemIds: [group.id],
        data: {priority: nextPriority},
        failSilently: true,
        project: [group.project.id],
      },
      {
        success: () => {
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

export function GroupPriority({group, onChange}: GroupDetailsPriorityProps) {
  const onChangePriority = useChangePriority(group, onChange);

  // We can assume that when there is not `priorityLockedAt`, there were no
  // user edits to the priority.
  const lastEditedBy = group.priorityLockedAt ? undefined : 'system';

  return (
    <GroupPriorityDropdown
      disabled={group.issueType === 'metric_issue'}
      groupId={group.id}
      onChange={onChangePriority}
      value={group.priority ?? PriorityLevel.MEDIUM}
      lastEditedBy={lastEditedBy}
    />
  );
}

export function GroupPriorityCommandPaletteAction({
  group,
}: Pick<GroupDetailsPriorityProps, 'group'>) {
  const onChangePriority = useChangePriority(group);
  const priority = group.priority ?? PriorityLevel.MEDIUM;

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
