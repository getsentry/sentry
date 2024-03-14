import {bulkUpdate} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {GroupPriorityDropdown} from 'sentry/components/group/groupPriority';
import {t} from 'sentry/locale';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import {type Group, PriorityLevel} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type GroupDetailsPriorityProps = {
  group: Group;
  onChange?: (priority: PriorityLevel) => void;
};

function GroupPriority({group, onChange}: GroupDetailsPriorityProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();

  const onChangePriority = (priority: PriorityLevel) => {
    if (priority === group.priority) {
      return;
    }

    trackAnalytics('issue_details.set_priority', {
      organization,
      ...getAnalyticsDataForGroup(group),
      from_priority: group.priority,
      to_priority: priority,
    });

    addLoadingMessage(t('Saving changes\u2026'));
    IssueListCacheStore.reset();

    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        itemIds: [group.id],
        data: {priority},
        failSilently: true,
      },
      {
        success: () => {
          clearIndicators();
          onChange?.(priority);
        },
        error: () => {
          clearIndicators();
          addErrorMessage(t('Unable to update issue priority'));
        },
      }
    );
  };

  // We can assume that when there is not `priorityLockedAt`, there were no
  // user edits to the priority.
  const lastEditedBy = !group.priorityLockedAt ? 'system' : undefined;

  return (
    <GroupPriorityDropdown
      groupId={group.id}
      onChange={onChangePriority}
      value={group.priority ?? PriorityLevel.MEDIUM}
      lastEditedBy={lastEditedBy}
    />
  );
}

export default GroupPriority;
