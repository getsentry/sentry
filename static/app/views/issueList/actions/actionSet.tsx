import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import ActionLink from 'sentry/components/actions/actionLink';
import ArchiveActions from 'sentry/components/actions/archive';
import IgnoreActions from 'sentry/components/actions/ignore';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {BaseGroup, GroupStatus, Project} from 'sentry/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {IssueTypeConfig} from 'sentry/utils/issueTypeConfig/types';
import Projects from 'sentry/utils/projects';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';

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
  onUpdate: (data?: any) => void;
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
    organization,
  });

  const label = getLabel(numIssues, allInQuerySelected);

  const selectedIssues = [...issues]
    .map(issueId => GroupStore.get(issueId))
    .filter(issue => issue) as BaseGroup[];

  // Merges require multiple issues of a single project type
  const multipleIssueProjectsSelected = multiSelected && !selectedProjectSlug;
  const {enabled: mergeSupported, disabledReason: mergeDisabledReason} =
    isActionSupported(selectedIssues, 'merge');
  const {enabled: deleteSupported, disabledReason: deleteDisabledReason} =
    isActionSupported(selectedIssues, 'delete');
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

  // Determine whether to nest "Merge" and "Mark as Reviewed" buttons inside
  // the dropdown menu based on the current screen size
  const theme = useTheme();
  const nestMergeAndReview = useMedia(`(max-width: ${theme.breakpoints.xlarge})`);
  const hasEscalatingIssuesUi = organization.features.includes('escalating-issues');

  const menuItems: MenuItemProps[] = [
    {
      key: 'merge',
      label: t('Merge'),
      hidden: !nestMergeAndReview,
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
      hidden: !nestMergeAndReview,
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
          onConfirm: () => onUpdate({status: GroupStatus.UNRESOLVED}),
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
      {hasEscalatingIssuesUi && query.includes('is:archived') ? (
        <Button
          size="xs"
          onClick={() => {
            openConfirmModal({
              bypass: !onShouldConfirm(ConfirmAction.UNRESOLVE),
              onConfirm: () => onUpdate({status: GroupStatus.UNRESOLVED}),
              message: confirm({action: ConfirmAction.UNRESOLVE, canBeUndone: true}),
              confirmText: label('unarchive'),
            });
          }}
          disabled={!anySelected}
        >
          {t('Unarchive')}
        </Button>
      ) : null}
      {selectedProjectSlug ? (
        <Projects orgId={organization.slug} slugs={[selectedProjectSlug]}>
          {({projects, initiallyLoaded, fetchError}) => {
            const selectedProject = projects[0];
            return (
              <ResolveActions
                onShouldConfirm={onShouldConfirm}
                onUpdate={onUpdate}
                anySelected={anySelected}
                params={{
                  hasRelease: selectedProject.hasOwnProperty('features')
                    ? (selectedProject as Project).features.includes('releases')
                    : false,
                  latestRelease: selectedProject.hasOwnProperty('latestRelease')
                    ? (selectedProject as Project).latestRelease
                    : undefined,
                  projectSlug: selectedProject.slug,
                  confirm,
                  label,
                  loadingProjects: !initiallyLoaded,
                  projectFetchError: !!fetchError,
                }}
              />
            );
          }}
        </Projects>
      ) : (
        <ResolveActions
          onShouldConfirm={onShouldConfirm}
          onUpdate={onUpdate}
          anySelected={anySelected}
          params={{
            hasRelease: false,
            multipleProjectsSelected: true,
            disabled: true,
            confirm,
            label,
          }}
        />
      )}
      {hasEscalatingIssuesUi ? (
        <GuideAnchor
          target="issue_stream_archive_button"
          position="bottom"
          disabled={ignoreDisabled}
        >
          <ArchiveActions
            onUpdate={onUpdate}
            shouldConfirm={onShouldConfirm(ConfirmAction.IGNORE)}
            confirmMessage={() =>
              confirm({action: ConfirmAction.IGNORE, canBeUndone: true})
            }
            confirmLabel={label('archive')}
            disabled={ignoreDisabled}
          />
        </GuideAnchor>
      ) : (
        <IgnoreActions
          onUpdate={onUpdate}
          shouldConfirm={onShouldConfirm(ConfirmAction.IGNORE)}
          confirmMessage={() =>
            confirm({action: ConfirmAction.IGNORE, canBeUndone: true})
          }
          confirmLabel={label('ignore')}
          disabled={ignoreDisabled}
        />
      )}
      {!nestMergeAndReview && (
        <ReviewAction disabled={!canMarkReviewed} onUpdate={onUpdate} />
      )}
      {!nestMergeAndReview && (
        <ActionLink
          aria-label={t('Merge Selected Issues')}
          type="button"
          disabled={mergeDisabled}
          onAction={onMerge}
          shouldConfirm={onShouldConfirm(ConfirmAction.MERGE)}
          message={confirm({action: ConfirmAction.MERGE, canBeUndone: false})}
          confirmLabel={label('merge')}
          title={makeMergeTooltip()}
        >
          {t('Merge')}
        </ActionLink>
      )}
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
