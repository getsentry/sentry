import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';

const CRASH_REPORT_SOURCES: string[] = [
  'user_report_envelope',
  'user_report_sentry_django_endpoint',
  'crash_report_embed_form',
] as const;

export default function hasLinkedError(item: FeedbackIssueListItem): boolean {
  // If it is in CRASH_REPORT_SOURCES, it has a linked error, or if it is a new_feedback_envelope, check associated_event_id
  // Can potentially remove this after all feedbacks have associated_event_id in their metadata (~90 days)
  return (
    CRASH_REPORT_SOURCES.includes(item.metadata.source ?? '') ||
    item.metadata.hasOwnProperty('associated_event_id')
  );
}
