import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ActionLink from 'sentry/components/actions/actionLink';
import IgnoreActions from 'sentry/components/actions/ignore';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import {MenuItemProps} from 'sentry/components/dropdownMenuItemV2';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {Organization, Project, ResolutionStatus} from 'sentry/types';
import Projects from 'sentry/utils/projects';
import useMedia from 'sentry/utils/useMedia';

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
  orgSlug: Organization['slug'];
  query: string;
  queryCount: number;
  selectedProjectSlug?: string;
};

function ActionSet({
  orgSlug,
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
  const numIssues = issues.size;
  const confirm = getConfirm(numIssues, allInQuerySelected, query, queryCount);
  const label = getLabel(numIssues, allInQuerySelected);

  // merges require a single project to be active in an org context
  // selectedProjectSlug is null when 0 or >1 projects are selected.
  const mergeDisabled = !(multiSelected && selectedProjectSlug);

  const selectedIssues = [...issues].map(GroupStore.get);
  const canMarkReviewed =
    anySelected && (allInQuerySelected || selectedIssues.some(issue => !!issue?.inbox));

  // Determine whether to nest "Merge" and "Mark as Reviewed" buttons inside
  // the dropdown menu based on the current screen size
  const theme = useTheme();
  const nestMergeButton = useMedia(`(max-width: ${theme.breakpoints[2]})`);
  const nestMarkReviewedButton = useMedia(`(max-width: ${theme.breakpoints[1]})`);

  const menuItems: MenuItemProps[] = [
    {
      key: 'merge',
      label: t('Merge'),
      hidden: !nestMergeButton,
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.MERGE),
          onConfirm: onMerge,
          message: confirm(ConfirmAction.MERGE, false),
          confirmText: label('merge'),
        });
      },
    },
    {
      key: 'mark-reviewed',
      label: t('Mark Reviewed'),
      hidden: !nestMarkReviewedButton,
      onAction: () => onUpdate({inbox: false}),
    },
    {
      key: 'bookmark',
      label: t('Add to Bookmarks'),
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.BOOKMARK),
          onConfirm: () => onUpdate({isBookmarked: true}),
          message: confirm(ConfirmAction.BOOKMARK, false),
          confirmText: label('bookmark'),
        });
      },
    },
    {
      key: 'remove-bookmark',
      label: t('Remove from Bookmarks'),
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.UNBOOKMARK),
          onConfirm: () => onUpdate({isBookmarked: false}),
          message: confirm('remove', false, ' from your bookmarks'),
          confirmText: label('remove', ' from your bookmarks'),
        });
      },
    },
    {
      key: 'unresolve',
      label: t('Set status to: Unresolved'),
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.UNRESOLVE),
          onConfirm: () => onUpdate({status: ResolutionStatus.UNRESOLVED}),
          message: confirm(ConfirmAction.UNRESOLVE, true),
          confirmText: label('unresolve'),
        });
      },
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          bypass: !onShouldConfirm(ConfirmAction.DELETE),
          onConfirm: onDelete,
          priority: 'danger',
          message: confirm(ConfirmAction.DELETE, false),
          confirmText: label('delete'),
        });
      },
    },
  ];

  const disabledMenuItems = [
    ...(mergeDisabled ? ['merge'] : []),
    ...(canMarkReviewed ? ['mark-reviewed'] : []),
  ];

  return (
    <Wrapper>
      {selectedProjectSlug ? (
        <Projects orgId={orgSlug} slugs={[selectedProjectSlug]}>
          {({projects, initiallyLoaded, fetchError}) => {
            const selectedProject = projects[0];
            return (
              <ResolveActions
                onShouldConfirm={onShouldConfirm}
                onUpdate={onUpdate}
                anySelected={anySelected}
                orgSlug={orgSlug}
                params={{
                  hasReleases: selectedProject.hasOwnProperty('features')
                    ? (selectedProject as Project).features.includes('releases')
                    : false,
                  latestRelease: selectedProject.hasOwnProperty('latestRelease')
                    ? (selectedProject as Project).latestRelease
                    : undefined,
                  projectId: selectedProject.slug,
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
          orgSlug={orgSlug}
          params={{
            hasReleases: false,
            latestRelease: null,
            projectId: null,
            confirm,
            label,
          }}
        />
      )}

      <IgnoreActions
        onUpdate={onUpdate}
        shouldConfirm={onShouldConfirm(ConfirmAction.IGNORE)}
        confirmMessage={confirm(ConfirmAction.IGNORE, true)}
        confirmLabel={label('ignore')}
        disabled={!anySelected}
      />
      <GuideAnchor target="inbox_guide_review" position="bottom">
        {!nestMarkReviewedButton && (
          <ReviewAction disabled={!canMarkReviewed} onUpdate={onUpdate} />
        )}
      </GuideAnchor>
      {!nestMergeButton && (
        <ActionLink
          type="button"
          disabled={mergeDisabled}
          onAction={onMerge}
          shouldConfirm={onShouldConfirm(ConfirmAction.MERGE)}
          message={confirm(ConfirmAction.MERGE, false)}
          confirmLabel={label('merge')}
          title={t('Merge Selected Issues')}
        >
          {t('Merge')}
        </ActionLink>
      )}
      <DropdownMenuControlV2
        items={menuItems}
        triggerProps={{
          'aria-label': t('More issue actions'),
          icon: <IconEllipsis size="xs" />,
          showChevron: false,
          size: 'xsmall',
        }}
        disabledKeys={disabledMenuItems}
        isDisabled={!anySelected}
      />
    </Wrapper>
  );
}

export default ActionSet;

const Wrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 66.66%;
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    width: 50%;
  }
  flex: 1;
  margin: 0 ${space(1)};
  display: grid;
  gap: ${space(0.5)};
  grid-auto-flow: column;
  justify-content: flex-start;
  white-space: nowrap;
`;
