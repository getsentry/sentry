import {Fragment, useCallback} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {Button} from '@sentry/scraps/button';
import {openConfirmModal} from '@sentry/scraps/confirm';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {ArchiveActions} from 'sentry/components/actions/archive';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {makeGroupPriorityDropdownOptions} from 'sentry/components/badge/groupPriority';
import {t} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {BaseGroup} from 'sentry/types/group';
import {GroupStatus, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import type {IssueTypeConfig} from 'sentry/utils/issueTypeConfig/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import {
  getFilterWriteDisabledReason,
  offersInProductFilters,
} from 'sentry/views/settings/project/projectFilters/inProductFilterAccess';

import {CopyActions} from './copyActions';
import {ResolveActionsContainer as ResolveActions} from './resolveActions';
import {ConfirmAction, getConfirm, getLabel} from './utils';

// The API drafts filters from at most this many issues.
const MAX_ISSUES_PER_FILTER_DRAFT = 100;

// The modal and its form live with the project settings, so the issue stream only
// loads them once the action runs.
async function openSuggestedFiltersModal(project: Project, groupIds: string[]) {
  const {openSuggestedFiltersModal: open} =
    await import('sentry/views/settings/project/projectFilters/customFilterModal');
  open({project, groupIds});
}

// Why the selection cannot become a custom inbound filter, or undefined when it can.
// A filter belongs to one project and drops errors, and the API drafts it from the
// issues it is given, so it needs their IDs.
function getAddInboundFilterDisabledReason({
  allInQuerySelected,
  organization,
  project,
  selectedIssues,
}: {
  allInQuerySelected: boolean;
  organization: Organization;
  project: Project | undefined;
  selectedIssues: BaseGroup[];
}): string | undefined {
  if (allInQuerySelected) {
    return t('Select issues on this page instead of every issue of the search');
  }
  if (!project) {
    return t('Select issues of one project');
  }
  if (selectedIssues.some(issue => issue.issueCategory !== IssueCategory.ERROR)) {
    return t('Inbound filters only apply to error issues');
  }
  if (selectedIssues.length > MAX_ISSUES_PER_FILTER_DRAFT) {
    return t('Select at most %s issues', MAX_ISSUES_PER_FILTER_DRAFT);
  }
  return getFilterWriteDisabledReason(organization, project);
}

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

export function ActionSet({
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
  const area = useAnalyticsArea();

  const handleUpdate = useCallback(
    (data: IssueUpdateData) => {
      if ('status' in data && data.status === 'ignored') {
        const statusDetails =
          'ignoreCount' in data.statusDetails
            ? 'ignoreCount'
            : 'ignoreDuration' in data.statusDetails
              ? 'ignoreDuration'
              : 'ignoreUserCount' in data.statusDetails
                ? 'ignoreUserCount'
                : undefined;
        trackAnalytics('issues_stream.archived', {
          organization,
          action_status_details: statusDetails,
          action_substatus: data.substatus,
          area,
        });
      }
      if ('status' in data && data.status === 'resolved') {
        const statusDetails =
          'inRelease' in data.statusDetails
            ? 'inRelease'
            : 'inNextRelease' in data.statusDetails
              ? 'inNextRelease'
              : 'inCommit' in data.statusDetails
                ? 'inCommit'
                : 'inUpcomingRelease' in data.statusDetails
                  ? 'inUpcomingRelease'
                  : undefined;
        trackAnalytics('issues_stream.resolved', {
          organization,
          action_status_details: statusDetails,
          area,
        });
      }
      if ('priority' in data) {
        trackAnalytics('issues_stream.updated_priority', {
          organization,
          priority: data.priority,
          area,
        });
      }
      onUpdate(data);
    },
    [area, onUpdate, organization]
  );
  const numIssues = issues.size;
  const confirm = getConfirm({numIssues, allInQuerySelected, query, queryCount});

  const label = getLabel(numIssues, allInQuerySelected);

  const selectedIssues = Array.from(issues, issueId => GroupStore.get(issueId)).filter(
    issue => issue !== undefined
  );

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

  const filterProject = selectedProjectSlug
    ? ProjectsStore.getBySlug(selectedProjectSlug)
    : undefined;
  const addInboundFilterDisabledReason = getAddInboundFilterDisabledReason({
    allInQuerySelected,
    organization,
    project: filterProject,
    selectedIssues,
  });

  const makeMergeTooltip = () => {
    if (mergeDisabledReason) {
      return mergeDisabledReason;
    }

    if (multipleIssueProjectsSelected) {
      return t('Cannot merge issues from different projects');
    }

    return '';
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
      key: 'bookmark',
      label: t('Add to Bookmarks'),
      hidden: !canAddBookmark,
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.BOOKMARK),
          onConfirm: () => handleUpdate({isBookmarked: true}),
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
          onConfirm: () => handleUpdate({isBookmarked: false}),
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
          onConfirm: () =>
            handleUpdate({status: GroupStatus.UNRESOLVED, statusDetails: {}}),
          message: confirm({action: ConfirmAction.UNRESOLVE, canBeUndone: true}),
          confirmText: label('unresolve'),
        });
      },
    },
    {
      key: 'add-inbound-filter',
      label: t('Add Inbound Filter'),
      hidden: !offersInProductFilters(organization),
      disabled: addInboundFilterDisabledReason !== undefined,
      details: addInboundFilterDisabledReason,
      onAction: () => {
        if (!filterProject) {
          return;
        }
        trackAnalytics('issues_stream.add_inbound_filter', {
          organization,
          project_id: filterProject.id,
          platform: filterProject.platform,
          issue_count: selectedIssues.length,
          area,
        });
        openSuggestedFiltersModal(
          filterProject,
          selectedIssues.map(issue => issue.id)
        );
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
                handleUpdate({status: GroupStatus.UNRESOLVED, statusDetails: {}}),
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
        onUpdate={handleUpdate}
        anySelected={anySelected}
        confirm={confirm}
        label={label}
        selectedProjectSlug={selectedProjectSlug}
      />
      <ArchiveActions
        onUpdate={handleUpdate}
        shouldConfirm={onShouldConfirm(ConfirmAction.ARCHIVE)}
        confirmMessage={() => confirm({action: ConfirmAction.ARCHIVE, canBeUndone: true})}
        confirmLabel={label('archive')}
        disabled={ignoreDisabled}
      />
      <Button
        size="xs"
        onClick={handleMergeClick}
        disabled={mergeDisabled}
        tooltipProps={{title: makeMergeTooltip()}}
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
              onConfirm: () => handleUpdate({priority}),
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
      <CopyActions
        allInQuerySelected={allInQuerySelected}
        anySelected={anySelected}
        selectedIssues={selectedIssues}
      />
      <DropdownMenu
        size="sm"
        items={menuItems}
        trigger={triggerProps => (
          <OverlayTrigger.IconButton
            {...triggerProps}
            aria-label={t('More issue actions')}
            icon={<IconEllipsis />}
            size="xs"
          />
        )}
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
