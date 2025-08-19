import {Fragment, useEffect, useMemo, useState} from 'react';

import {openModal} from 'sentry/actionCreators/modal';
import ArchiveActions from 'sentry/components/actions/archive';
import {makeGroupPriorityDropdownOptions} from 'sentry/components/badge/groupPriority';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import {Select} from 'sentry/components/core/select';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useIssueLabels} from 'sentry/hooks/useIssueLabels';
import {IconAdd, IconCheckmark, IconCircle, IconEllipsis, IconTag} from 'sentry/icons';
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

export default function ActionSet({
  queryCount,
  query,
  allInQuerySelected,
  issues,
  onUpdate,
  onDelete,
  onMerge,
  onShouldConfirm,
  anySelected,
  multiSelected,
  selectedProjectSlug,
  ...props
}: Props) {
  const {addLabel, getAllLabelNames, getIssueLabels, removeLabel, allLabels} =
    useIssueLabels();
  const [memberList, setMemberList] = useState<Record<string, any>>({});

  // Local state for label management
  const [localLabels, setLocalLabels] = useState<
    Array<{color: string; id: string; name: string}>
  >([]);
  const [localIssueId, setLocalIssueId] = useState<string | null>(null);

  // Local state for the selected labels in the dropdown
  const [localSelectedLabels, setLocalSelectedLabels] = useState<string[]>([]);

  // Control dropdown open state
  const [isOpen, setIsOpen] = useState(false);

  // Update local state when issues change
  useEffect(() => {
    if (issues.size === 1) {
      const issueId = Array.from(issues)[0]!;
      const initialLabels = getIssueLabels(issueId);
      setLocalIssueId(issueId);
      setLocalLabels(initialLabels);
      setLocalSelectedLabels(initialLabels.map(label => label.name));
    } else {
      setLocalIssueId(null);
      setLocalLabels([]);
      setLocalSelectedLabels([]);
    }
  }, [issues, getIssueLabels]);

  // Update local state when labels change externally
  useEffect(() => {
    if (localIssueId && allLabels[localIssueId]) {
      const currentLabels = allLabels[localIssueId];
      setLocalLabels(currentLabels);
      setLocalSelectedLabels(currentLabels.map(label => label.name));
    }
  }, [localIssueId, allLabels]);

  // Prepare the label management component data
  const issueId = issues.size > 0 ? Array.from(issues)[0]! : null;

  const allLabelNames = useMemo(() => getAllLabelNames(), [getAllLabelNames]);

  const labelOptions: Array<{
    key: string;
    label: string;
    options: Array<SelectOption<string>>;
  }> = useMemo(
    () => [
      {
        key: 'labels',
        label: t('Labels'),
        options: allLabelNames.map(labelName => ({
          value: labelName,
          label: labelName,
        })),
      },
    ],
    [allLabelNames]
  );

  const labelValue = localSelectedLabels;

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

  function AddLabelModal({Body, Header, Footer, closeModal}: any) {
    const [labelName, setLabelName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
      const trimmed = labelName.trim();
      if (!trimmed) {
        setError(t('Label name cannot be empty'));
        return;
      }
      // Apply to selected issues only (MVP does not support "all in query")
      issues.forEach(id => {
        if (id) {
          addLabel(id, trimmed);
        }
      });
      closeModal();
    };

    return (
      <Fragment>
        <Header closeButton>{t('Add Label')}</Header>
        <Body>
          <p>{t('Apply a label to the selected issues.')}</p>
          <Input
            placeholder={t('Enter label name')}
            value={labelName}
            onChange={e => {
              setLabelName(e.target.value);
              setError('');
            }}
            autoFocus
          />
          {error ? <div style={{color: 'var(--red400)'}}>{error}</div> : null}
          {allInQuerySelected ? (
            <p style={{marginTop: 8}}>
              {t(
                'Note: This MVP applies to currently selected issues, not "all in query".'
              )}
            </p>
          ) : null}
        </Body>
        <Footer>
          <Button priority="primary" size="sm" onClick={handleSubmit}>
            {t('Add Label')}
          </Button>
        </Footer>
      </Fragment>
    );
  }

  const handleAddLabelClick = (labelName: string) => {
    if (!anySelected) {
      return;
    }
    // Apply to selected issues only (MVP does not support "all in query")
    issues.forEach(id => {
      if (id) {
        addLabel(id, labelName);
      }
    });
  };

  const handleAddMoreLabels = () => {
    if (!anySelected) {
      return;
    }
    openModal(modalProps => <AddLabelModal {...modalProps} />);
  };

  const handleMergeClick = () => {
    openConfirmModal({
      bypass: !onShouldConfirm(ConfirmAction.MERGE),
      onConfirm: onMerge,
      message: confirm({action: ConfirmAction.MERGE, canBeUndone: false}),
      confirmText: label('merge'),
    });
  };

  const menuItems: MenuItemProps[] = [
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
      {/* Single issue selected - use CompactSelect for label management */}
      {issueId && (
        <CompactSelect
          multiple
          size="xs"
          value={labelValue}
          onOpenChange={setIsOpen}
          onChange={(selected: Array<SelectOption<string>>) => {
            console.log('selected:', selected);
            const selectedNames = selected.map((opt: SelectOption<string>) => opt.value);

            // Find labels to add (new selections that don't exist)
            const labelsToAdd = selectedNames.filter(
              (labelName: string) => !localLabels.some(label => label.name === labelName)
            );

            // Find labels to remove (existing labels that are no longer selected)
            const labelsToRemove = localLabels.filter(
              label => !selectedNames.includes(label.name)
            );

            // Add new labels
            labelsToAdd.forEach((labelName: string) => {
              addLabel(issueId, labelName);
            });

            // Remove labels that are no longer selected
            labelsToRemove.forEach(label => {
              removeLabel(issueId, label.id);
            });

            // Update local state immediately to reflect the changes
            const newLabels = selectedNames.map(labelName => {
              // Find existing label or create a temporary one
              const existing = localLabels.find(label => label.name === labelName);
              if (existing) {
                return existing;
              }
              // Create temporary label for immediate UI update
              return {
                id: `${issueId}-${labelName}-temp`,
                name: labelName,
                color: '#3F51B5', // Default color
              };
            });
            setLocalLabels(newLabels);
            setLocalSelectedLabels(selectedNames);
          }}
          options={labelOptions}
          triggerProps={{
            'aria-label': t('Add Labels'),
            icon: <IconTag />,
            size: 'xs',
          }}
          triggerLabel={t('Add Labels')}
          clearable
          closeOnSelect={false}
          menuFooter={
            <Button
              size="xs"
              icon={<IconAdd />}
              onClick={() => {
                // Close the dropdown first
                setIsOpen(false);
                // Open the add label modal
                openModal(AddLabelModal);
              }}
            >
              {t('Add Label')}
            </Button>
          }
        />
      )}
      <Button
        size="xs"
        onClick={handleMergeClick}
        disabled={mergeDisabled}
        title={makeMergeTooltip()}
      >
        {t('Merge')}
      </Button>
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
