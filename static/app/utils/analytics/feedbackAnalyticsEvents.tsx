export type FeedbackEventParameters = {
  'feedback.index-old-ui-clicked': {};
  'feedback.index-setup-button-clicked': {};
  'feedback.index-setup-viewed': {};
};

export type FeedbackEventKey = keyof FeedbackEventParameters;

export const feedbackEventMap: Record<FeedbackEventKey, string | null> = {
  'feedback.index-setup-button-clicked': 'Clicked Feedback Onboarding Setup Button',
  'feedback.index-old-ui-clicked': 'Clicked Go To Old User Feedback Button',
  'feedback.index-setup-viewed': 'Viewed Feedback Onboarding Setup',
};
