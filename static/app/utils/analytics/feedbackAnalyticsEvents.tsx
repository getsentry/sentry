export type FeedbackEventParameters = {
  'feedback.details-integration-issue-clicked': {
    integration_key: string;
  };
  'feedback.feedback-item-copy-as-markdown': Record<string, unknown>;
  'feedback.feedback-item-not-found': {feedbackId: string};
  'feedback.feedback-item-rendered': Record<string, unknown>;
  'feedback.index-setup-viewed': Record<string, unknown>;
  'feedback.list-item-selected': Record<string, unknown>;
  'feedback.list-view-setup-sidebar': {platform: string};
  'feedback.mark-spam-clicked': {type: 'bulk' | 'details'};
  'feedback.no_associated_event_found': {orgSlug: string};
  'feedback.summary.categories-empty': Record<string, unknown>;
  'feedback.summary.categories-error': Record<string, unknown>;
  'feedback.summary.categories-rendered': {num_categories: number};
  'feedback.summary.categories-too-few-feedbacks': Record<string, unknown>;
  'feedback.summary.category-selected': {category: string};
  'feedback.summary.seer-cta-rendered': Record<string, unknown>;
  'feedback.summary.summary-error': Record<string, unknown>;
  'feedback.summary.summary-rendered': Record<string, unknown>;
  'feedback.summary.summary-too-few-feedbacks': Record<string, unknown>;
  'feedback.trace-section.crash-report-dup': Record<string, unknown>;
  'feedback.trace-section.error': Record<string, unknown>;
  'feedback.trace-section.loaded': {numEvents: number};
  'feedback.whats-new-banner-dismissed': Record<string, unknown>;
  'feedback.whats-new-banner-viewed': Record<string, unknown>;
};

type FeedbackEventKey = keyof FeedbackEventParameters;

export const feedbackEventMap: Record<FeedbackEventKey, string | null> = {
  'feedback.feedback-item-copy-as-markdown': 'Copied Feedback Item as Markdown',
  'feedback.feedback-item-not-found': 'Feedback item not found',
  'feedback.feedback-item-rendered': 'Loaded and rendered a feedback item',
  'feedback.index-setup-viewed': 'Viewed Feedback Onboarding Setup',
  'feedback.list-item-selected': 'Selected Item in Feedback List',
  'feedback.details-integration-issue-clicked':
    'Clicked Integration Issue Button in Feedback Details',
  'feedback.whats-new-banner-dismissed': 'Dismissed Feedback Whats New Banner',
  'feedback.whats-new-banner-viewed': 'Viewed Feedback Whats New Banner',
  'feedback.mark-spam-clicked': 'Marked Feedback as Spam',
  'feedback.list-view-setup-sidebar': 'Viewed Feedback Onboarding Sidebar',
  'feedback.trace-section.crash-report-dup':
    'The Only Same-trace Issue Matches Associated Event ID',
  'feedback.trace-section.error': 'Error Fetching Trace Data in Feedback Details',
  'feedback.trace-section.loaded': 'Fetched Same-trace Issue Data in Feedback Details',
  'feedback.no_associated_event_found': 'Associated Event Not Found in Feedback',
  'feedback.summary.categories-empty': 'No Feedback Categories To Render',
  'feedback.summary.categories-error': 'Error Rendering Feedback Categories',
  'feedback.summary.categories-rendered': 'Rendered Feedback Categories',
  'feedback.summary.categories-too-few-feedbacks':
    'Too Few Feedbacks to Render Feedback Categories',
  'feedback.summary.category-selected': 'Selected Feedback Category',
  'feedback.summary.seer-cta-rendered': 'Rendered Feedback Summary Seer CTA',
  'feedback.summary.summary-error': 'Error Rendering Feedback Summary',
  'feedback.summary.summary-rendered': 'Rendered Feedback Summary',
  'feedback.summary.summary-too-few-feedbacks':
    'Too Few Feedbacks to Render Feedback Summary',
};
