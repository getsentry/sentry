import {Client} from 'sentry/api';

/**
 * Shared API client used by React Query fetchers (`apiFetch`,
 * `apiFetchInfinite`) and `fetchMutation`.
 *
 * Lives in its own module so that consumers can depend on it without
 * creating import cycles (e.g. between `apiFetch` and `queryClient`).
 */
export const QUERY_API_CLIENT = new Client();
