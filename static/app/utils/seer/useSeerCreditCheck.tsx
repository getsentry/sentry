import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * The billable Seer operations the credit check can price. Mirrors
 * `SeerOperation` in `src/sentry/seer/credits.py`.
 */
export type SeerCreditOperation =
  | 'agent_chat_message'
  | 'autofix_root_cause'
  | 'autofix_solution'
  | 'autofix_code_changes'
  | 'autofix_open_pr'
  | 'autofix_pr_iteration';

/**
 * Why the check denied credit:
 *
 * - `not_enough_credits`: the wallet can't cover the operation.
 * - `daily_cap_exceeded`: the operation would take today's spend over the
 *   org's daily usage limit.
 */
export type SeerCreditDenialReason = 'not_enough_credits' | 'daily_cap_exceeded';

interface SeerCreditCheckResponse {
  /**
   * Null when the check allows the operation, or doesn't say why it doesn't.
   */
  denialReason: SeerCreditDenialReason | null;
  hasEnoughCredits: boolean;
}

export function seerCreditCheckApiOptions(
  organization: Organization,
  operation: SeerCreditOperation
) {
  return apiOptions.as<SeerCreditCheckResponse>()(
    '/organizations/$organizationIdOrSlug/seer/credit-check/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {operation},
      staleTime: 0,
    }
  );
}

/**
 * Matches the org's credit checks for every operation, so they can all be
 * rechecked at once, for example after credits are added.
 */
export function seerCreditChecksQueryKey(organization: Organization) {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/seer/credit-check/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
  ];
}

interface UseSeerCreditCheckOptions {
  /**
   * Skip the check, for example while the trigger it gates is not on screen.
   */
  enabled?: boolean;
}

/**
 * Whether the organization can afford one Seer operation, such as the next
 * autofix step or a chat message.
 *
 * This is separate from `useOrganizationSeerSetup`: setup-check answers "is
 * Seer on this plan" and is mounted on many pages that should not make a
 * billing call. Only mount this where a Seer trigger is about to be shown.
 *
 * The check fails open. Without `seer-credit-checks` and
 * `token-billed-seer-enabled`, or when the request fails, `hasEnoughCredits`
 * is `true` and the backend has the final say.
 */
export function useSeerCreditCheck(
  operation: SeerCreditOperation,
  {enabled = true}: UseSeerCreditCheckOptions = {}
) {
  const organization = useOrganization();
  // Orgs without token-billed Seer have no wallet to check, so they make no
  // billing call.
  const isChecking =
    enabled &&
    organization.features.includes('seer-credit-checks') &&
    organization.features.includes('token-billed-seer-enabled');

  const query = useQuery({
    ...seerCreditCheckApiOptions(organization, operation),
    enabled: isChecking,
    // Credits move outside this page: a run elsewhere spends them and a billing
    // member can turn on auto-reload from another tab. Recheck on every mount and window
    // focus (which the app's query client turns off by default) so a gate
    // never outlives the balance it was based on.
    refetchOnWindowFocus: true,
    // Fail open on the first error instead of holding callers' placeholders
    // through the default retries.
    retry: false,
  });

  return {
    hasEnoughCredits: isChecking ? (query.data?.hasEnoughCredits ?? true) : true,
    denialReason: isChecking ? (query.data?.denialReason ?? null) : null,
    /**
     * Whether the check has answered, or failed, since the caller mounted. A
     * cached answer from an earlier mount doesn't count, since credits can
     * change in between. Wait on this rather than `isPending` before acting on
     * the answer automatically.
     */
    hasCheckedSinceMount: !isChecking || query.isFetchedAfterMount,
    // A disabled query reports `isPending` forever, so only a running check
    // counts as pending.
    isPending: isChecking && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
