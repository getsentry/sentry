import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import ActionLink from 'app/components/actions/actionLink';
import IgnoreActions from 'app/components/actions/ignore';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';
import {IconEllipsis, IconIssues, IconPause, IconPlay} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, ResolutionStatus} from 'app/types';
import Projects from 'app/utils/projects';

import ResolveActions from './resolveActions';
import {ConfirmAction, getConfirm, getLabel} from './utils';

type Props = {
  orgSlug: Organization['slug'];
  queryCount: number;
  query: string;
  realtimeActive: boolean;
  allInQuerySelected: boolean;
  anySelected: boolean;
  multiSelected: boolean;
  issues: Set<string>;
  onShouldConfirm: (action: ConfirmAction) => boolean;
  onDelete: () => void;
  onRealtimeChange: () => void;
  onMerge: () => void;
  onUpdate: (data?: any) => void;
  selectedProjectSlug?: string;
  hasInbox?: boolean;
};

function ActionSet({
  orgSlug,
  queryCount,
  query,
  realtimeActive,
  allInQuerySelected,
  anySelected,
  multiSelected,
  issues,
  onUpdate,
  onShouldConfirm,
  onDelete,
  onRealtimeChange,
  onMerge,
  selectedProjectSlug,
  hasInbox,
}: Props) {
  const numIssues = issues.size;
  const confirm = getConfirm(numIssues, allInQuerySelected, query, queryCount);
  const label = getLabel(numIssues, allInQuerySelected);

  // merges require a single project to be active in an org context
  // selectedProjectSlug is null when 0 or >1 projects are selected.
  const mergeDisabled = !(multiSelected && selectedProjectSlug);

  return (
    <Wrapper hasInbox={hasInbox}>
      {hasInbox && (
        <div className="btn-group hidden-sm hidden-xs">
          <StyledActionLink
            className="btn btn-primary btn-sm action-merge"
            data-test-id="button-acknowledge"
            disabled={!anySelected}
            onAction={() => onUpdate({inbox: false})}
            shouldConfirm={onShouldConfirm(ConfirmAction.ACKNOWLEDGE)}
            message={confirm('mark', false, ' as reviewed')}
            confirmLabel={label('Mark', ' as reviewed')}
            title={t('Mark Reviewed')}
          >
            <StyledIconIssues size="xs" />
            {t('Mark Reviewed')}
          </StyledActionLink>
        </div>
      )}
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
      <div className="btn-group hidden-md hidden-sm hidden-xs">
        <ActionLink
          className="btn btn-default btn-sm action-merge"
          disabled={mergeDisabled}
          onAction={onMerge}
          shouldConfirm={onShouldConfirm(ConfirmAction.MERGE)}
          message={confirm(ConfirmAction.MERGE, false)}
          confirmLabel={label('merge')}
          title={t('Merge Selected Issues')}
        >
          {t('Merge')}
        </ActionLink>
      </div>
      <div className="btn-group">
        <DropdownLink
          key="actions"
          caret={false}
          className="btn btn-sm btn-default action-more"
          title={
            <IconPad>
              <IconEllipsis size="xs" />
            </IconPad>
          }
        >
          <MenuItem noAnchor>
            <ActionLink
              className="action-merge hidden-lg hidden-xl"
              disabled={mergeDisabled}
              onAction={onMerge}
              shouldConfirm={onShouldConfirm(ConfirmAction.MERGE)}
              message={confirm(ConfirmAction.MERGE, false)}
              confirmLabel={label('merge')}
              title={t('Merge Selected Issues')}
            >
              {t('Merge')}
            </ActionLink>
          </MenuItem>
          {hasInbox && (
            <React.Fragment>
              <MenuItem divider className="hidden-md hidden-lg hidden-xl" />
              <MenuItem noAnchor>
                <ActionLink
                  className="action-acknowledge hidden-md hidden-lg hidden-xl"
                  disabled={!anySelected}
                  onAction={() => onUpdate({inbox: false})}
                  shouldConfirm={onShouldConfirm(ConfirmAction.ACKNOWLEDGE)}
                  message={confirm(ConfirmAction.ACKNOWLEDGE, false)}
                  confirmLabel={label('acknowledge')}
                  title={t('Acknowledge')}
                >
                  {t('Acknowledge')}
                </ActionLink>
              </MenuItem>
            </React.Fragment>
          )}
          <MenuItem divider className="hidden-lg hidden-xl" />
          <MenuItem noAnchor>
            <ActionLink
              className="action-bookmark"
              disabled={!anySelected}
              onAction={() => onUpdate({isBookmarked: true})}
              shouldConfirm={onShouldConfirm(ConfirmAction.BOOKMARK)}
              message={confirm(ConfirmAction.BOOKMARK, false)}
              confirmLabel={label('bookmark')}
              title={t('Add to Bookmarks')}
            >
              {t('Add to Bookmarks')}
            </ActionLink>
          </MenuItem>
          <MenuItem divider />
          <MenuItem noAnchor>
            <ActionLink
              className="action-remove-bookmark"
              disabled={!anySelected}
              onAction={() => onUpdate({isBookmarked: false})}
              shouldConfirm={onShouldConfirm(ConfirmAction.UNBOOKMARK)}
              message={confirm('remove', false, ' from your bookmarks')}
              confirmLabel={label('remove', ' from your bookmarks')}
              title={t('Remove from Bookmarks')}
            >
              {t('Remove from Bookmarks')}
            </ActionLink>
          </MenuItem>
          <MenuItem divider />
          <MenuItem noAnchor>
            <ActionLink
              className="action-unresolve"
              disabled={!anySelected}
              onAction={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
              shouldConfirm={onShouldConfirm(ConfirmAction.UNRESOLVE)}
              message={confirm(ConfirmAction.UNRESOLVE, true)}
              confirmLabel={label('unresolve')}
              title={t('Set status to: Unresolved')}
            >
              {t('Set status to: Unresolved')}
            </ActionLink>
          </MenuItem>
          <MenuItem divider />
          <MenuItem noAnchor>
            <ActionLink
              className="action-delete"
              disabled={!anySelected}
              onAction={onDelete}
              shouldConfirm={onShouldConfirm(ConfirmAction.DELETE)}
              message={confirm(ConfirmAction.DELETE, false)}
              confirmLabel={label('delete')}
              title={t('Delete Issues')}
            >
              {t('Delete Issues')}
            </ActionLink>
          </MenuItem>
        </DropdownLink>
      </div>
      {!hasInbox && (
        <div className="btn-group">
          <Tooltip
            title={t('%s real-time updates', realtimeActive ? t('Pause') : t('Enable'))}
          >
            <a
              data-test-id="realtime-control"
              className="btn btn-default btn-sm hidden-xs"
              onClick={onRealtimeChange}
            >
              <IconPad>
                {realtimeActive ? <IconPause size="xs" /> : <IconPlay size="xs" />}
              </IconPad>
            </a>
          </Tooltip>
        </div>
      )}
    </Wrapper>
  );
}

export default ActionSet;

const StyledActionLink = styled(ActionLink)`
  display: flex;
  align-items: center;
  transition: none;
`;

// New icons are misaligned inside bootstrap buttons.
// This is a shim that can be removed when buttons are upgraded
// to styled components.
const IconPad = styled('span')`
  position: relative;
  top: ${space(0.25)};
`;

const StyledIconIssues = styled(IconIssues)`
  margin-right: ${space(0.5)};
`;

const Wrapper = styled('div')<{hasInbox?: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 66.66%;
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    width: 50%;
  }
  flex: 1;
  margin-left: ${space(1)};
  margin-right: ${space(1)};
  display: flex;
  ${p =>
    p.hasInbox &&
    css`
      animation: 0.15s linear ZoomUp forwards;
    `};

  .btn-group {
    display: flex;
    margin-right: 6px;
  }

  @keyframes ZoomUp {
    0% {
      opacity: 0;
      transform: translateY(5px);
    }
    100% {
      opacity: 1;
      transform: tranlsateY(0);
    }
  }
`;
