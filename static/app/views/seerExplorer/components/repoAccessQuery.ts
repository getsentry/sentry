import {queryOptions} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';

export const REPO_ACCESS_POLL_INTERVAL_MS = 5_000;
export const REPO_ACCESS_WAIT_MS = 10 * 60_000;

export interface RepoAccess {
  connectedAccounts: string[];
  status:
    | 'found'
    | 'no_scm_integration'
    | 'repo_ambiguous'
    | 'repo_not_in_sentry'
    | 'repos_syncing'
    | 'scm_account_not_connected'
    | 'unknown';
  syncFailure?: string;
}

export function repoAccessQueryOptions({
  orgSlug,
  repoName,
  integrationId,
  checkId,
}: {
  orgSlug: string;
  repoName: string | null;
  checkId?: string;
  integrationId?: string;
}) {
  const options = apiOptions.as<RepoAccess>()(
    '/organizations/$organizationIdOrSlug/seer/repo-access/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {repoName: repoName ?? undefined, integrationId},
      staleTime: 0,
    }
  );
  const baseKey: ApiQueryKey = options.queryKey;
  // A result from before this pause or install is not evidence that the new check is ready.
  const queryKey: ApiQueryKey = checkId ? [...baseKey, {checkId}] : baseKey;
  return {...options, queryKey, retry: false as const};
}

// Client-only state: keep the installed integration on the pause so the popup and modal use
// the same query, including when the chat is moved to/from picture-in-picture and remounts.
export function repoAccessInstallScope(orgSlug: string, pauseId: string) {
  return queryOptions({
    queryKey: ['seer-scm-installed-integration', orgSlug, pauseId],
    queryFn: (): string | null => null,
    initialData: null,
    enabled: false,
  });
}
