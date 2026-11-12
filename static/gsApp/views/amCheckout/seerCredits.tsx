import {useQuery, type QueryClient} from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';

import {toast} from '@sentry/scraps/toast';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {seerCreditChecksQueryKey} from 'sentry/utils/seer/useSeerCreditCheck';

import {displayPrice} from 'getsentry/utils/billing';
import type {CheckoutFormData, SeerAutoLoad} from 'getsentry/views/amCheckout/types';
import {
  seerWalletAutoTopUpOptions,
  seerWalletBalanceOptions,
  type SeerWalletAutoTopUp,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

/**
 * Each paid plan includes $5 of Seer credits every month. Plans don't
 * serialize the Seer credits line item yet, so this mirrors getsentry's
 * SEER_CREDITS_RESERVED.
 */
export const SEER_INCLUDED_CREDITS_CENTS = 500;

/**
 * One Seer credit costs a cent. Checkout can't read this from the wallet,
 * which only exists once the organization is billed on credits.
 */
export const SEER_CREDIT_PRICE_CENTS = 1;

const DEFAULT_LOAD_AMOUNT_CENTS = 2500;
const DEFAULT_DAILY_LIMIT_CENTS = 10000;

// The auto top-up endpoint rejects anything lower.
const MIN_LOAD_AMOUNT_CENTS = 1500;
const MIN_DAILY_LIMIT_CENTS = 100;

const DEFAULT_SEER_AUTO_LOAD: SeerAutoLoad = {
  enabled: false,
  loadAmountCents: DEFAULT_LOAD_AMOUNT_CENTS,
  dailyLimitCents: DEFAULT_DAILY_LIMIT_CENTS,
};

/**
 * Whether the organization pays for Seer with credits, the only Seer billing
 * that has auto-load.
 */
export function hasTokenBilledSeer(organization: Organization) {
  return organization.features.includes('token-billed-seer-enabled');
}

export function seerCreditsFromCents(cents: number) {
  return Math.floor(cents / SEER_CREDIT_PRICE_CENTS);
}

function getSavedSeerAutoLoad(autoTopUp: SeerWalletAutoTopUp | undefined): SeerAutoLoad {
  // Turning on starts from the defaults rather than amounts the customer never
  // picked.
  if (!autoTopUp?.enabled) {
    return DEFAULT_SEER_AUTO_LOAD;
  }
  return {
    enabled: true,
    // Both can be null on a config that was never saved.
    loadAmountCents:
      autoTopUp.topUpCredits > 0
        ? autoTopUp.topUpCredits * SEER_CREDIT_PRICE_CENTS
        : DEFAULT_LOAD_AMOUNT_CENTS,
    dailyLimitCents:
      autoTopUp.dailySpendCapCents > 0
        ? autoTopUp.dailySpendCapCents
        : DEFAULT_DAILY_LIMIT_CENTS,
  };
}

/**
 * The auto-load settings checkout shows: the customer's edits if they made
 * any, otherwise what's saved on their Seer wallet.
 */
export function useSeerAutoLoad({
  formData,
  organization,
}: {
  formData: CheckoutFormData;
  organization: Organization;
}) {
  const isTokenBilled = hasTokenBilledSeer(organization);
  const autoTopUpQuery = useQuery({
    ...seerWalletAutoTopUpOptions(organization),
    enabled: isTokenBilled,
  });

  if (!isTokenBilled) {
    return {isPending: false, seerAutoLoad: null, seerAutoLoadToSave: undefined};
  }

  // Without saved settings, checkout can still turn auto-load on.
  const savedSeerAutoLoad = getSavedSeerAutoLoad(autoTopUpQuery.data);
  const pickedSeerAutoLoad = formData.seerAutoLoad;
  const hasChanges =
    pickedSeerAutoLoad !== undefined &&
    // Amounts edited while auto-load is off aren't worth saving.
    (pickedSeerAutoLoad.enabled || savedSeerAutoLoad.enabled) &&
    !isEqual(pickedSeerAutoLoad, savedSeerAutoLoad);

  return {
    isPending: autoTopUpQuery.isPending,
    seerAutoLoad: pickedSeerAutoLoad ?? savedSeerAutoLoad,
    /**
     * What checkout should save to the Seer wallet, if anything changed.
     */
    seerAutoLoadToSave: hasChanges ? pickedSeerAutoLoad : undefined,
  };
}

export function getSeerLoadAmountError(seerAutoLoad: SeerAutoLoad) {
  if (seerAutoLoad.enabled && seerAutoLoad.loadAmountCents < MIN_LOAD_AMOUNT_CENTS) {
    return tct('Must be at least [amount].', {
      amount: displayPrice({cents: MIN_LOAD_AMOUNT_CENTS}),
    });
  }
  return null;
}

export function getSeerDailyLimitError(seerAutoLoad: SeerAutoLoad) {
  if (seerAutoLoad.enabled && seerAutoLoad.dailyLimitCents < MIN_DAILY_LIMIT_CENTS) {
    return tct('Must be at least [amount].', {
      amount: displayPrice({cents: MIN_DAILY_LIMIT_CENTS}),
    });
  }
  return null;
}

export function getSeerAutoLoadError(seerAutoLoad: SeerAutoLoad | null) {
  if (!seerAutoLoad) {
    return null;
  }
  const error =
    getSeerLoadAmountError(seerAutoLoad) ?? getSeerDailyLimitError(seerAutoLoad);
  return error ? t('Fix your Seer auto-load settings to continue.') : null;
}

/**
 * Saves the auto-load settings picked in checkout to the Seer wallet. The plan
 * change has already gone through by then, so a failure doesn't undo it; the
 * customer can retry from the billing page.
 */
export async function saveSeerAutoLoad({
  organization,
  queryClient,
  seerAutoLoad,
}: {
  organization: Organization;
  queryClient: QueryClient;
  seerAutoLoad: SeerAutoLoad;
}) {
  try {
    await fetchMutation<SeerWalletAutoTopUp>({
      url: getApiUrl('/customers/$organizationIdOrSlug/seer-wallet/auto-top-up/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      method: 'PUT',
      data: {
        enabled: seerAutoLoad.enabled,
        topUpCredits: seerCreditsFromCents(seerAutoLoad.loadAmountCents),
        dailySpendCapCents: seerAutoLoad.dailyLimitCents,
      },
    });
  } catch (error) {
    // A 402 means the settings were saved, but the first load, billed when the
    // balance is already low, couldn't be charged.
    if (error instanceof RequestError && error.status === 402) {
      toast.error(
        t(
          "Seer auto-load is on, but we couldn't charge your payment method for its first load. Check your payment method on the billing page."
        )
      );
    } else {
      toast.error(
        t(
          'Your plan was updated, but Seer auto-load was not saved. Try again from your billing page.'
        )
      );
    }
  } finally {
    // Turning on can bill credits right away, and either outcome can change
    // whether Seer may run.
    queryClient.invalidateQueries({
      queryKey: seerWalletAutoTopUpOptions(organization).queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: seerWalletBalanceOptions(organization).queryKey,
    });
    queryClient.invalidateQueries({queryKey: seerCreditChecksQueryKey(organization)});
  }
}
