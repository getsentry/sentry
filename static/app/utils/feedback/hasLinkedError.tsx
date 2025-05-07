import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';

const CRASH_REPORT_SOURCES: string[] = [
  'user_report_envelope',
  'user_report_sentry_django_endpoint',
  'crash_report_embed_form',
] as const;

export default function hasLinkedError(item: FeedbackIssueListItem): boolean {
  return CRASH_REPORT_SOURCES.includes(item.metadata.source ?? '');
}
