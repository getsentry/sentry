import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';

/**
 * FormModel only toasts array-valued or non-field errors, so nested workflow
 * validation errors fall back to a generic message. Surface the first specific
 * message as a non-field error instead.
 */
export function mapAutomationFormErrors(responseJSON: any) {
  const message = getWorkflowEngineResponseErrorMessage(responseJSON);
  if (!message || responseJSON.non_field_errors || responseJSON.nonFieldErrors) {
    return responseJSON;
  }
  return {...responseJSON, nonFieldErrors: [message]};
}
