import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {GroupSearchView} from 'sentry/views/issueList/types';

const NEW_VIEW_PAGE_REGEX = /\/issues\/views\/new\/?$/;

/**
 * Returns true if the current path is the "New View" page
 * /issues/views/new/
 */
export function isNewViewPage(pathname: string) {
  return NEW_VIEW_PAGE_REGEX.test(pathname);
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
  if (user.isSuperuser || organization.access.includes('org:write')) {
    return true;
  }

  return user.id === groupSearchView.createdBy.id;
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
