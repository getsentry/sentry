import type {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';

export type AiSuggestedSolutionEventParameters = {
  'ai_suggested_solution.feedback_helpful_kinda_button_clicked': {
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
  'ai_suggested_solution.feedback_helpful_nope_button_clicked': {
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
  'ai_suggested_solution.feedback_helpful_yes_button_clicked': {
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
  'ai_suggested_solution.hide_details_button_clicked': {
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
  'ai_suggested_solution.hide_suggestion_button_clicked': {
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
  'ai_suggested_solution.show_details_button_clicked': {
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
  'ai_suggested_solution.view_suggestion_button_clicked': {
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
};

export const aiSuggestedSolutionEventMap: Record<
  keyof AiSuggestedSolutionEventParameters,
  string
> = {
  'ai_suggested_solution.view_suggestion_button_clicked':
    'AI Suggested Solution: View Suggestion Button Clicked',
  'ai_suggested_solution.feedback_helpful_yes_button_clicked':
    'AI Suggested Solution: Helpful - Yes Button Clicked',
  'ai_suggested_solution.feedback_helpful_kinda_button_clicked':
    'AI Suggested Solution: Helpful - Kinda Button Clicked',
  'ai_suggested_solution.feedback_helpful_nope_button_clicked':
    'AI Suggested Solution: Helpful - Nope Button Clicked',
  'ai_suggested_solution.hide_suggestion_button_clicked':
    'AI Suggested Solution: Hide Suggestion Button Clicked',
  'ai_suggested_solution.hide_details_button_clicked':
    'AI Suggested Solution: Hide Details Button Clicked',
  'ai_suggested_solution.show_details_button_clicked':
    'AI Suggested Solution: Show Details Button Clicked',
};
