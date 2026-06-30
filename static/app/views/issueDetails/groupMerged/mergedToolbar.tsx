import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {openDiffModal} from 'sentry/actionCreators/modal';
import {Confirm} from 'sentry/components/confirm';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import {
  type FingerprintWithLatestEvent,
  type GroupMergedState,
  isAllUnmergedSelected,
} from './useGroupMerged';

type Props = {
  enableFingerprintCompare: boolean;
  fingerprints: FingerprintWithLatestEvent[];
  groupId: Group['id'];
  onToggleCollapse: () => void;
  onUnmerge: () => void;
  project: Project;
  state: GroupMergedState;
  unmergeDisabled: boolean;
};

export function MergedToolbar({
  enableFingerprintCompare,
  fingerprints,
  groupId,
  project,
  state,
  unmergeDisabled,
  onUnmerge,
  onToggleCollapse,
}: Props) {
  const {unmergeLastCollapsed, unmergeList} = state;

  const unmergeCount = unmergeList.size;

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
      baseEventId,
      targetEventId,
    });
  }

  const unmergeDisabledReason =
    fingerprints.length <= 1
      ? t('To unmerge, the list must contain 2 or more items')
      : unmergeList.size === 0
        ? t('To unmerge, 1 or more items must be selected')
        : isAllUnmergedSelected(state, fingerprints)
          ? t('We are unable to unmerge all items at once')
          : undefined;

  return (
    <PanelHeader hasButtons>
      <Grid flow="column" align="center" gap="md">
        <Confirm
          disabled={unmergeDisabled}
          onConfirm={onUnmerge}
          message={t(
            'These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'
          )}
        >
          <Button size="xs" tooltipProps={{title: unmergeDisabledReason}}>
            {fingerprints.length <= 1
              ? t('Unmerge')
              : tct('Unmerge ([itemsSelectedQuantity])', {
                  itemsSelectedQuantity: unmergeCount,
                })}
          </Button>
        </Confirm>

        <Button
          size="xs"
          disabled={!enableFingerprintCompare}
          onClick={handleShowDiff}
          tooltipProps={{
            title: enableFingerprintCompare
              ? undefined
              : t('To compare, exactly 2 items must be selected'),
          }}
        >
          {t('Compare')}
        </Button>
      </Grid>
      <Button size="xs" onClick={onToggleCollapse}>
        {unmergeLastCollapsed ? t('Expand All') : t('Collapse All')}
      </Button>
    </PanelHeader>
  );
}
