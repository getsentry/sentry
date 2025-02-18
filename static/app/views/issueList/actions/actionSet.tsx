import {Fragment} from 'react';

import ArchiveActions from 'sentry/components/actions/archive';
import {makeGroupPriorityDropdownOptions} from 'sentry/components/badge/groupPriority';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import type {BaseGroup} from 'sentry/types/group';
import {GroupStatus} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import type {IssueTypeConfig} from 'sentry/utils/issueTypeConfig/types';
import useOrganization from 'sentry/utils/useOrganization';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import {FOR_REVIEW_QUERIES} from 'sentry/views/issueList/utils';

import ResolveActions from './resolveActions';
import ReviewAction from './reviewAction';
import {ConfirmAction, getConfirm, getLabel} from './utils';

type Props = {
  allInQuerySelected: boolean;
  anySelected: boolean;
  issues: Set<string>;
  multiSelected: boolean;
  onDelete: () => void;
  onMerge: () => void;
  onShouldConfirm: (action: ConfirmAction) => boolean;
  onUpdate: (data: IssueUpdateData) => void;
  query: string;
  queryCount: number;
  selectedProjectSlug?: string;
};

function ActionSet({
  queryCount,
  query,
  allInQuerySelected,
  anySelected,
  multiSelected,
  issues,
  onUpdate,
  onShouldConfirm,
  onDelete,
  onMerge,
  selectedProjectSlug,
}: Props) {
  const organization = useOrganization();
  const numIssues = issues.size;
  const confirm = getConfirm({
    numIssues,
    allInQuerySelected,
    query,
    queryCount,
  });

  const label = getLabel(numIssues, allInQuerySelected);

  const selectedIssues = [...issues]
    .map(issueId => GroupStore.get(issueId))
    .filter(issue => issue) as BaseGroup[];

  // Merges require multiple issues of a single project type
  const multipleIssueProjectsSelected = multiSelected && !selectedProjectSlug;
  const {enabled: mergeSupported, disabledReason: mergeDisabledReason} =
    isActionSupported(selectedIssues, 'merge');

  // Members may or may not have access to delete events based on organization settings
  const hasDeleteAccess = organization.access.includes('event:admin');
  const {enabled: deleteSupported, disabledReason: deleteDisabledReason} = hasDeleteAccess
    ? isActionSupported(selectedIssues, 'delete')
    : {enabled: false, disabledReason: t('You do not have permission to delete issues')};

  const mergeDisabled =
    !multiSelected || multipleIssueProjectsSelected || !mergeSupported;
  const ignoreDisabled = !anySelected;

  const canMarkReviewed =
    anySelected && (allInQuerySelected || selectedIssues.some(issue => !!issue?.inbox));

  // determine which ... dropdown options to show based on issue(s) selected
  const canAddBookmark =
    allInQuerySelected || selectedIssues.some(issue => !issue.isBookmarked);
  const canRemoveBookmark =
    allInQuerySelected || selectedIssues.some(issue => issue.isBookmarked);
  const canSetUnresolved =
    allInQuerySelected ||
    selectedIssues.some(
      issue => issue.status === 'resolved' || issue.status === 'ignored'
    );

  const makeMergeTooltip = () => {
    if (mergeDisabledReason) {
      return mergeDisabledReason;
    }

    if (multipleIssueProjectsSelected) {
      return t('Cannot merge issues from different projects');
    }

    return '';
  };

  const nestReview = !FOR_REVIEW_QUERIES.includes(query);

  const menuItems: MenuItemProps[] = [
    {
      key: 'merge',
      label: t('Merge'),
      disabled: mergeDisabled,
      details: makeMergeTooltip(),
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.MERGE),
          onConfirm: onMerge,
          message: confirm({action: ConfirmAction.MERGE, canBeUndone: false}),
          confirmText: label('merge'),
        });
      },
    },
    {
      key: 'mark-reviewed',
      label: t('Mark Reviewed'),
      hidden: !nestReview,
      disabled: !canMarkReviewed,
      onAction: () => onUpdate({inbox: false}),
    },
    {
      key: 'bookmark',
      label: t('Add to Bookmarks'),
      hidden: !canAddBookmark,
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.BOOKMARK),
          onConfirm: () => onUpdate({isBookmarked: true}),
          message: confirm({action: ConfirmAction.BOOKMARK, canBeUndone: false}),
          confirmText: label('bookmark'),
        });
      },
    },
    {
      key: 'remove-bookmark',
      label: t('Remove from Bookmarks'),
      hidden: !canRemoveBookmark,
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.UNBOOKMARK),
          onConfirm: () => onUpdate({isBookmarked: false}),
          message: confirm({
            action: ConfirmAction.UNBOOKMARK,
            canBeUndone: false,
            append: ' from your bookmarks',
          }),
          confirmText: label('remove', ' from your bookmarks'),
        });
      },
    },
    {
      key: 'unresolve',
      label: t('Set status to: Unresolved'),
      hidden: !canSetUnresolved,
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.UNRESOLVE),
          onConfirm: () => onUpdate({status: GroupStatus.UNRESOLVED, statusDetails: {}}),
          message: confirm({action: ConfirmAction.UNRESOLVE, canBeUndone: true}),
          confirmText: label('unresolve'),
        });
      },
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      disabled: !deleteSupported,
      details: deleteDisabledReason,
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.DELETE),
          onConfirm: onDelete,
          priority: 'danger',
          message: confirm({action: ConfirmAction.DELETE, canBeUndone: false}),
          confirmText: label('delete'),
        });
      },
    },
  ];

  return (
    <Fragment>
      {query.includes('is:archived') ? (
        <Button
          size="xs"
          onClick={() => {
            openConfirmModal({
              bypass: !onShouldConfirm(ConfirmAction.UNRESOLVE),
              onConfirm: () =>
                onUpdate({status: GroupStatus.UNRESOLVED, statusDetails: {}}),
              message: confirm({action: ConfirmAction.UNRESOLVE, canBeUndone: true}),
              confirmText: label('unarchive'),
            });
          }}
          disabled={!anySelected}
        >
          {t('Unarchive')}
        </Button>
      ) : null}
      <ResolveActions
        onShouldConfirm={onShouldConfirm}
        onUpdate={onUpdate}
        anySelected={anySelected}
        confirm={confirm}
        label={label}
        selectedProjectSlug={selectedProjectSlug}
      />
      <ArchiveActions
        onUpdate={onUpdate}
        shouldConfirm={onShouldConfirm(ConfirmAction.ARCHIVE)}
        confirmMessage={() => confirm({action: ConfirmAction.ARCHIVE, canBeUndone: true})}
        confirmLabel={label('archive')}
        disabled={ignoreDisabled}
      />
      <DropdownMenu
        triggerLabel={t('Set Priority')}
        size="xs"
        items={makeGroupPriorityDropdownOptions({
          onChange: priority => {
            openConfirmModal({
              bypass: !onShouldConfirm(ConfirmAction.SET_PRIORITY),
              onConfirm: () => onUpdate({priority}),
              message: confirm({
                action: ConfirmAction.SET_PRIORITY,
                append: ` to ${priority}`,
                canBeUndone: true,
              }),
              confirmText: label('reprioritize'),
            });
          },
          hasIssueStreamTableLayout: organization.features.includes(
            'issue-stream-table-layout'
          ),
        })}
      />
      {!nestReview && <ReviewAction disabled={!canMarkReviewed} onUpdate={onUpdate} />}
      <DropdownMenu
        size="sm"
        items={menuItems}
        triggerProps={{
          'aria-label': t('More issue actions'),
          icon: <IconEllipsis />,
          showChevron: false,
          size: 'xs',
        }}
        isDisabled={!anySelected}
      />
    </Fragment>
  );
}

function isActionSupported(
  selectedIssues: BaseGroup[],
  actionType: keyof IssueTypeConfig['actions']
) {
  for (const issue of selectedIssues) {
    const info = getConfigForIssueType(issue, issue.project).actions[actionType];

    if (!info.enabled) {
      return info;
    }
  }

  return {enabled: true};
}

export default ActionSet;
