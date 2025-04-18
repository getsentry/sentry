import type {User} from 'sentry/types/user';
import type {GroupSearchView} from 'sentry/views/issueList/types';

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
