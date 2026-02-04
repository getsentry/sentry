import {t} from 'sentry/locale';

/**
 * Maps assertion error types to user-friendly titles.
 */
function getAssertionErrorTitle(errorType: string): string {
  switch (errorType) {
    case 'compilation_error':
      return t('Compilation Error');
    case 'serialization_error':
      return t('Serialization Error');
    default:
      return t('Validation Error');
  }
}

/**
 * Checks if an object is an assertion error with error type and details.
 */
function isAssertionError(obj: unknown): obj is {details: string; error: string} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    'details' in obj &&
    'error' in obj
  );
}

/**
 * Formats an assertion error into a user-friendly message.
 */
function formatAssertionError(assertionError: {
  details: string;
  error: string;
}): string[] {
  const title = getAssertionErrorTitle(assertionError.error);
  return [`${title}: ${assertionError.details}`];
}

/**
 * Maps form errors from the API response format to the format expected by FormModel.
 *
 * Handles assertion errors in two formats:
 *
 * 1. Direct format (uptime alerts):
 *    {"assertion": {"error": "compilation_error", "details": "..."}}
 *
 * 2. Nested format (detector forms):
 *    {"dataSources": {"assertion": {"error": "compilation_error", "details": "..."}}}
 *
 * Both are transformed to: {"assertion": ["Compilation Error: <error details>"]}
 */
export function mapAssertionFormErrors(responseJson: any): any {
  if (!responseJson) {
    return responseJson;
  }

  const result = {...responseJson};

  // Handle direct assertion errors (uptime alerts endpoint)
  if (isAssertionError(result.assertion)) {
    result.assertion = formatAssertionError(result.assertion);
  }

  // Handle nested assertion errors (detector forms endpoint)
  if (result.dataSources && isAssertionError(result.dataSources.assertion)) {
    result.assertion = formatAssertionError(result.dataSources.assertion);
    // Remove assertion from dataSources but preserve other fields
    const {assertion: _, ...remainingDataSources} = result.dataSources;
    if (Object.keys(remainingDataSources).length > 0) {
      result.dataSources = remainingDataSources;
    } else {
      delete result.dataSources;
    }
  }

  return result;
}
