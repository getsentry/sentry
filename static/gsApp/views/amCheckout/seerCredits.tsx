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
import type {CheckoutFormData, SeerAutoReload} from 'getsentry/views/amCheckout/types';
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
 * One Seer credit costs a cent, as getsentry's SEER_CREDIT_RATE_CPE sets.
 */
export const SEER_CREDIT_PRICE_CENTS = 1;

const DEFAULT_SEER_AUTO_RELOAD: SeerAutoReload = {
  enabled: false,
  reloadAmountCents: 2500,
  dailyLimitCents: 10000,
};

/**
 * Whether the organization pays for Seer with credits, the only Seer billing
 * that has auto-reload.
 */
export function hasTokenBilledSeer(organization: Organization) {
  return organization.features.includes('token-billed-seer-enabled');
}

export function seerCreditsFromCents(cents: number) {
  return Math.floor(cents / SEER_CREDIT_PRICE_CENTS);
}

function getSavedSeerAutoReload(autoTopUp: SeerWalletAutoTopUp): SeerAutoReload {
  // Turning on starts from the defaults rather than amounts the customer never
  // picked.
  if (!autoTopUp.enabled) {
    return DEFAULT_SEER_AUTO_RELOAD;
  }
  return {
    enabled: true,
    reloadAmountCents: autoTopUp.topUpCredits * SEER_CREDIT_PRICE_CENTS,
    dailyLimitCents: autoTopUp.dailySpendCapCents,
  };
}

/**
 * The auto-reload settings checkout shows: the customer's edits if they made
 * any, otherwise what's saved on their Seer wallet.
 */
export function useSeerAutoReload({
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
  // The balance decides whether turning auto-reload on bills a reload right away.
  const balanceQuery = useQuery({
    ...seerWalletBalanceOptions(organization),
    enabled: isTokenBilled,
  });
  const isError = autoTopUpQuery.isError || balanceQuery.isError;
  const refetch = () => {
    autoTopUpQuery.refetch();
    balanceQuery.refetch();
  };

  const autoTopUp = autoTopUpQuery.data;
  const wallet = balanceQuery.data;
  if (!isTokenBilled || isError || !autoTopUp || !wallet) {
    // Without the saved settings, checkout can't tell what it would overwrite, and
    // without the balance, what turning auto-reload on charges. So it offers no
    // auto-reload.
    return {
      isTokenBilled,
      isPending: isTokenBilled && !isError,
      isError,
      refetch,
      seerAutoReload: null,
      seerAutoReloadToSave: undefined,
      reloadAmountError: null,
      reloadChargedTodayCents: 0,
    };
  }

  const savedSeerAutoReload = getSavedSeerAutoReload(autoTopUp);
  const pickedSeerAutoReload = formData.seerAutoReload;
  const seerAutoReload = pickedSeerAutoReload ?? savedSeerAutoReload;
  const hasChanges =
    pickedSeerAutoReload !== undefined &&
    // Amounts edited while auto-reload is off aren't worth saving.
    (pickedSeerAutoReload.enabled || savedSeerAutoReload.enabled) &&
    !isEqual(pickedSeerAutoReload, savedSeerAutoReload);
  const seerAutoReloadToSave = hasChanges ? pickedSeerAutoReload : undefined;

  const minReloadAmountCents = autoTopUp.minTopUpCredits * SEER_CREDIT_PRICE_CENTS;
  const reloadAmountError =
    seerAutoReload.enabled && seerAutoReload.reloadAmountCents < minReloadAmountCents
      ? tct('Must be at least [amount].', {
          amount: displayPrice({cents: minReloadAmountCents}),
        })
      : null;

  // Turning auto-reload on bills a reload at once, apart from the plan, when the
  // balance is at or below the threshold. Without purchased credits it always is,
  // since the included credits are the threshold.
  const isReloadChargedToday =
    seerAutoReloadToSave?.enabled === true &&
    !autoTopUp.enabled &&
    wallet.balance <= autoTopUp.thresholdCredits;

  return {
    isTokenBilled,
    isPending: false,
    isError: false,
    refetch,
    seerAutoReload,
    /**
     * What checkout should save to the Seer wallet, if anything changed.
     */
    seerAutoReloadToSave,
    reloadAmountError,
    reloadChargedTodayCents: isReloadChargedToday
      ? seerAutoReloadToSave.reloadAmountCents
      : 0,
  };
}

/**
 * Saves the auto-reload settings picked in checkout to the Seer wallet. The plan
 * change has already gone through by then, so a failure doesn't undo it; the
 * customer can retry from the billing page.
 */
export async function saveSeerAutoReload({
  organization,
  queryClient,
  seerAutoReload,
}: {
  organization: Organization;
  queryClient: QueryClient;
  seerAutoReload: SeerAutoReload;
}) {
  try {
    await fetchMutation<SeerWalletAutoTopUp>({
      url: getApiUrl('/customers/$organizationIdOrSlug/seer-wallet/auto-top-up/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      method: 'PUT',
      data: {
        enabled: seerAutoReload.enabled,
        topUpCredits: seerCreditsFromCents(seerAutoReload.reloadAmountCents),
        dailySpendCapCents: seerAutoReload.dailyLimitCents,
      },
    });
  } catch (error) {
    // A 402 means the settings were saved, but the first reload, billed when the
    // balance is already low, couldn't be charged.
    if (error instanceof RequestError && error.status === 402) {
      toast.error(
        t(
          "Seer auto-reload is on, but we couldn't charge your payment method for its first reload. Check your payment method on the billing page."
        )
      );
    } else {
      toast.error(
        t(
          'Your plan was updated, but Seer auto-reload was not saved. Try again from your billing page.'
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
