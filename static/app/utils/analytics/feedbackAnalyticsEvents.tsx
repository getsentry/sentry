export type FeedbackEventParameters = {
  'feedback.details-integration-issue-clicked': {
    integration_key: string;
  };
  'feedback.index-setup-viewed': {};
  'feedback.list-item-selected': {};
};

export type FeedbackEventKey = keyof FeedbackEventParameters;

export const feedbackEventMap: Record<FeedbackEventKey, string | null> = {
  'feedback.index-setup-viewed': 'Viewed Feedback Onboarding Setup',
  'feedback.list-item-selected': 'Selected Item in Feedback List',
  'feedback.details-integration-issue-clicked':
    'Clicked Integration Issue Button in Feedback Details',
};
