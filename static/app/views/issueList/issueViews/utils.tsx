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
  user,
}: {
  groupSearchView: GroupSearchView;
  user: User;
}) {
  // TODO: Allow org admins to edit issue views
  return user.id === groupSearchView.createdBy.id;
}
