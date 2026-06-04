import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

export const DEFAULT_TIME_FILTERS: PageFilters['datetime'] = {
  start: null,
  end: null,
  period: '14d',
  utc: null,
};
export const DEFAULT_ENVIRONMENTS: string[] = [];

/**
 * Savable properties of an IssueView, besides lable and position.
 * Changes to these properties are not automatically saved and can
 * trigger the unsaved changes indicator.
 */
export interface IssueViewParams {
  environments: string[];
  projects: number[];
  query: string;
  querySort: IssueSortOptions;
  timeFilters: PageFilters['datetime'];
}

export function canEditIssueView({
  groupSearchView,
  organization,
  user,
}: {
  groupSearchView: GroupSearchView;
  organization: Organization;
  user: User;
}) {
  if (organization.access.includes('org:write')) {
    return true;
  }

  return user.id === groupSearchView.createdBy?.id;
}

export function confirmDeleteIssueView({
  handleDelete,
  groupSearchView,
}: {
  groupSearchView: GroupSearchView;
  handleDelete: () => void;
}) {
  openConfirmModal({
    message: t('Are you sure you want to delete the view "%s"?', groupSearchView.name),
    isDangerous: true,
    confirmText: t('Delete View'),
    priority: 'danger',
    onConfirm: handleDelete,
  });
}
