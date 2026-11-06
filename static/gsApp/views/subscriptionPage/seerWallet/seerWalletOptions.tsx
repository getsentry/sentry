import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export type SeerWalletBalance = {
  /**
   * Remaining included plus purchased credits. Can go negative.
   */
  balance: number;
  included: {
    remaining: number;
    resetsAt: string | null;
    total: number;
  };
  /**
   * Share of included plus purchased credits used, from 0 to 1.
   */
  percentUsed: number;
  purchased: {
    expiresAt: string | null;
    remaining: number;
    total: number;
  };
  /**
   * Only returned to members with `org:billing`.
   */
  creditPriceCents?: number;
};

export type SeerWalletAutoTopUp = {
  dailySpendCapCents: number;
  enabled: boolean;
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
