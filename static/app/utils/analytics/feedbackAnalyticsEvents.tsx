export type FeedbackEventParameters = {
  'feedback.details-integration-issue-clicked': {
    integration_key: string;
  };
  'feedback.index-setup-viewed': {};
  'feedback.list-item-selected': {};
  'feedback.list-view-setup-sidebar': {platform: string};
  'feedback.mark-spam-clicked': {type: 'bulk' | 'details'};
  'feedback.whats-new-banner-dismissed': {};
  'feedback.whats-new-banner-viewed': {};
};

export type FeedbackEventKey = keyof FeedbackEventParameters;

export const feedbackEventMap: Record<FeedbackEventKey, string | null> = {
  'feedback.index-setup-viewed': 'Viewed Feedback Onboarding Setup',
  'feedback.list-item-selected': 'Selected Item in Feedback List',
  'feedback.details-integration-issue-clicked':
    'Clicked Integration Issue Button in Feedback Details',
  'feedback.whats-new-banner-dismissed': 'Dismissed Feedback Whats New Banner',
  'feedback.whats-new-banner-viewed': 'Viewed Feedback Whats New Banner',
  'feedback.mark-spam-clicked': 'Marked Feedback as Spam',
  'feedback.list-view-setup-sidebar': 'Viewed Feedback Onboarding Sidebar',
};
