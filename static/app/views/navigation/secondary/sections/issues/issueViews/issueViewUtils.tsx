import type {AvatarUser} from 'sentry/types/user';
import type {IssueViewParams} from 'sentry/views/issueList/issueViews/utils';

export interface IssueView extends IssueViewParams {
  createdBy: AvatarUser | null;
  dateCreated: string;
  dateUpdated: string;
  id: string;
  label: string;
  lastVisited: string | null;
  stars: number;
}
