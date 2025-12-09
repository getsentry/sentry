import type {DataCategory} from 'sentry/types/core';

import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import useSubscription from 'getsentry/hooks/useSubscription';
import {getParentAddOn} from 'getsentry/utils/billing';

/**
 * Hook to check if the org has billing access to the given product.
 * An org may have billing access to a product if the org has an active product trial for the product,
 * the org's subscription includes prepaid volumes for the product, the org has PAYG, or the org has
 * explicitly bought/enabled the product.
 *
 * @param product - The data category associated with the product to check access for
 * @returns True if the org has billing access to the given product, false otherwise.
 */
export function useProductBillingAccess(product: DataCategory): boolean {
  const subscription = useSubscription();
  const parentProduct = getParentAddOn(subscription, product, true);

  const {isEnabled} = useProductBillingMetadata(
    subscription,
    product,
    parentProduct ?? product
  );

  if (!subscription) {
    return false;
  }

  return isEnabled;
}
