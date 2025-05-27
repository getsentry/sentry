import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';

export default function hasLinkedError(item: FeedbackIssueListItem): boolean {
  return item.metadata.hasOwnProperty('associated_event_id');
}
