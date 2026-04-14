/**
 * Extracts the first human-readable error message from a workflow engine API
 * error response so that we can surface it to the user in a toast.
 *
 * TODO: When migrating to the new form components, we should consider adding this
 * functionality generically
 */
export function getWorkflowEngineResponseErrorMessage(
  responseJSON: Record<string, unknown> | undefined
): string | undefined {
  if (!responseJSON) {
    return undefined;
  }
  return findFirstMessage(responseJSON);
}

function findFirstMessage(obj: Record<string, unknown>): string | undefined {
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      if (typeof value[0] === 'string') {
        return value[0];
      }
      if (typeof value[0] === 'object' && value[0] !== null) {
        const nested = findFirstMessage(value[0] as Record<string, unknown>);
        if (nested) {
          return nested;
        }
      }
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = findFirstMessage(value as Record<string, unknown>);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}
