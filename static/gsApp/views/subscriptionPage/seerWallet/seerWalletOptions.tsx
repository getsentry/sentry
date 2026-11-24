import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

/**
 * Opens the auto-reload modal on any organization page. A link can say why Seer
 * stopped by adding one of the credit check's denial reasons, for example
 * `#open-seer-auto-reload-modal:daily_cap_exceeded`.
 */
export const SEER_AUTO_RELOAD_MODAL_HASH = '#open-seer-auto-reload-modal';

export type SeerWalletBalance = {
  /**
   * Remaining included plus purchased credits. Can go negative.
   */
  balance: number;
  /**
   * The daily usage limit and what's left of it today, in credits. `remaining`
   * can go negative. Null means no daily usage limit.
   */
  dailyLimit: {remaining: number; total: number} | null;
  included: {remaining: number; resetsAt: string | null; total: number};
  /**
   * Share of included plus purchased credits used, from 0 to 1.
   */
  percentUsed: number;
  purchased: {expiresAt: string | null; remaining: number; total: number};
  /**
   * Only returned to members with `org:billing`.
   */
  creditPriceCents?: number;
};

export type SeerWalletAutoTopUp = {
  /**
   * Null means no daily usage limit.
   */
  dailySpendCapCents: number | null;
  enabled: boolean;
  minTopUpCredits: number;
  thresholdCredits: number;
  topUpCredits: number;
};

export function seerWalletBalanceOptions(organization: Organization) {
  return apiOptions.as<SeerWalletBalance>()(
    '/customers/$organizationIdOrSlug/seer-wallet/',
    {path: {organizationIdOrSlug: organization.slug}, staleTime: 0}
  );
}

export function seerWalletAutoTopUpOptions(organization: Organization) {
  return apiOptions.as<SeerWalletAutoTopUp>()(
    '/customers/$organizationIdOrSlug/seer-wallet/auto-top-up/',
    {path: {organizationIdOrSlug: organization.slug}, staleTime: 0}
  );
}
