import styled from '@emotion/styled';

import {openDiffModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import GroupingStore from 'sentry/stores/groupingStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';

type Props = {
  groupId: Group['id'];
  onToggleCollapse: () => void;
  onUnmerge: () => void;
  orgId: Organization['slug'];
  project: Project;
};

export function MergedToolbar({
  groupId,
  project,
  orgId,
  onUnmerge,
  onToggleCollapse,
}: Props) {
  const {
    unmergeList,
    mergedItems,
    unmergeLastCollapsed,
    unmergeDisabled,
    enableFingerprintCompare,
  } = useLegacyStore(GroupingStore);

  const unmergeCount = unmergeList?.size ?? 0;

  function handleShowDiff(event: React.MouseEvent) {
    event.stopPropagation();

    const entries = unmergeList.entries();

    // `unmergeList` should only have 2 items in map
    if (unmergeList.size !== 2) {
      return;
    }

    // only need eventId, not fingerprint
    const [baseEventId, targetEventId] = Array.from(entries).map(
      ([, eventId]) => eventId
    );

    openDiffModal({
      targetIssueId: groupId,
      project,
      baseIssueId: groupId,
      orgId,
      baseEventId,
      targetEventId,
    });
  }

  const unmergeDisabledReason =
    mergedItems.length <= 1
      ? t('To unmerge, the list must contain 2 or more items')
      : unmergeList.size === 0
      ? t('To unmerge, 1 or more items must be selected')
      : GroupingStore.isAllUnmergedSelected()
      ? t('We are unable to unmerge all items at once')
      : undefined;

  return (
    <PanelHeader hasButtons>
      <div>
        <Confirm
          disabled={unmergeDisabled}
          onConfirm={onUnmerge}
          message={t(
            'These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'
          )}
        >
          <Button size="sm" title={unmergeDisabledReason}>
            {mergedItems.length <= 1
              ? t('Unmerge')
              : tct('Unmerge ([itemsSelectedQuantity])', {
                  itemsSelectedQuantity: unmergeCount,
                })}
          </Button>
        </Confirm>

        <CompareButton
          size="sm"
          disabled={!enableFingerprintCompare}
          onClick={handleShowDiff}
          title={
            !enableFingerprintCompare
              ? t('To compare, exactly 2 items must be selected')
              : undefined
          }
        >
          {t('Compare')}
        </CompareButton>
      </div>
      <Button size="sm" onClick={onToggleCollapse}>
        {unmergeLastCollapsed ? t('Expand All') : t('Collapse All')}
      </Button>
    </PanelHeader>
  );
}

const CompareButton = styled(Button)`
  margin-left: ${space(1)};
`;
