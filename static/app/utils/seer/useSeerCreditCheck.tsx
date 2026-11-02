import {skipToken, useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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
  | 'autofix_create_pr'
  | 'autofix_pr_iteration';

interface SeerCreditCheckResponse {
  hasEnoughCredits: boolean;
}

export function hasSeerCreditChecks(organization: Organization) {
  return organization.features.includes('seer-credit-checks');
}

interface SeerCreditCheckOptionsParams {
  operation: SeerCreditOperation;
  organization: Organization;
  enabled?: boolean;
}

export function seerCreditCheckOptions({
  organization,
  operation,
  enabled = true,
}: SeerCreditCheckOptionsParams) {
  return apiOptions.as<SeerCreditCheckResponse>()(
    '/organizations/$organizationIdOrSlug/seer/credit-check/',
    {
      path:
        enabled && hasSeerCreditChecks(organization)
          ? {organizationIdOrSlug: organization.slug}
          : skipToken,
      query: {operation},
      // Credits move outside this page: a run elsewhere spends them and a
      // billing member can top up from another tab. Refetch on every mount and
      // window focus so a gate never outlives the balance it was based on.
      staleTime: 0,
    }
  );
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
 * The check fails open. Without `seer-credit-checks`, or when the request
 * fails, `hasEnoughCredits` is `true` and the backend has the final say.
 */
export function useSeerCreditCheck(
  operation: SeerCreditOperation,
  {enabled = true}: UseSeerCreditCheckOptions = {}
) {
  const organization = useOrganization();
  const isChecking = enabled && hasSeerCreditChecks(organization);

  const query = useQuery({
    ...seerCreditCheckOptions({organization, operation, enabled}),
    retry: false,
  });

  return {
    hasEnoughCredits: isChecking ? (query.data?.hasEnoughCredits ?? true) : true,
    // A disabled query reports `isPending` forever, so only a running check
    // counts as pending.
    isPending: isChecking && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
