import type {InvestigationQueryResult} from 'sentry/views/seerNotebook/types';

export function isQueryResult(value: unknown): value is InvestigationQueryResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    value.schemaVersion === 1 &&
    'tableMarkdown' in value &&
    typeof value.tableMarkdown === 'string' &&
    'preferredView' in value
  );
}
