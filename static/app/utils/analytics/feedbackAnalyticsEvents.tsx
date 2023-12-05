export type FeedbackEventParameters = {
  'feedback.details-integration-issue-clicked': {
    integration_key: string;
  };
  'feedback.index-old-ui-clicked': {};
  'feedback.index-setup-button-clicked': {};
  'feedback.index-setup-viewed': {};
  'feedback.list-item-selected': {};
};

export type FeedbackEventKey = keyof FeedbackEventParameters;

export const feedbackEventMap: Record<FeedbackEventKey, string | null> = {
  'feedback.index-setup-button-clicked': 'Clicked Feedback Onboarding Setup Button',
  'feedback.index-old-ui-clicked': 'Clicked Go To Old User Feedback Button',
  'feedback.index-setup-viewed': 'Viewed Feedback Onboarding Setup',
  'feedback.list-item-selected': 'Selected Item in Feedback List',
  'feedback.details-integration-issue-clicked':
    'Clicked Integration Issue Button in Feedback Details',
};
