import type {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useOrganization from 'sentry/utils/useOrganization';

import type {AddOn, AddOnCategory, ProductTrial, Subscription} from 'getsentry/types';
import {
  checkIsAddOn,
  getActiveProductTrial,
  getBilledCategory,
  getPotentialProductTrial,
  productIsEnabled,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
} from 'getsentry/utils/dataCategory';

interface ProductBillingMetadata {
  /**
   * The active product trial for the given product, if any.
   * Always null when excludeProductTrials is true.
   */
  activeProductTrial: ProductTrial | null;
  /**
   * The billed category for the given product.
   * When product is a DataCategory, we just return product.
   * When product is an AddOnCategory, we return the billed category for the
   * add-on.
   */
  billedCategory: DataCategory | null;
  /**
   * The display name for the given product in title case.
   */
  displayName: string;
  /**
   * Whether the product is an add-on.
   */
  isAddOn: boolean;
  /**
   * Whether the product is enabled for the subscription.
   */
  isEnabled: boolean;
  /**
   * The longest available product trial for the given product, if any.
   * Always null when excludeProductTrials is true.
   */
  potentialProductTrial: ProductTrial | null;
  /**
   * Whether the usage for the given product has exceeded the limit.
   */
  usageExceeded: boolean;
  /**
   * The add-on information for the given product from the subscription,
   * if any.
   */
  addOnInfo?: AddOn;
  /**
   * Link to the in-app page for the given product, if any.
   */
  productLink?: string;
}

const EMPTY_PRODUCT_BILLING_METADATA: ProductBillingMetadata = {
  billedCategory: null,
  displayName: '',
  isAddOn: false,
  isEnabled: false,
  usageExceeded: false,
  activeProductTrial: null,
  potentialProductTrial: null,
};

export function useProductBillingMetadata(
  subscription: Subscription | null,
  product: DataCategory | AddOnCategory,
  parentProduct?: DataCategory | AddOnCategory,
  excludeProductTrials?: boolean
): ProductBillingMetadata {
  const organization = useOrganization();
  const isAddOn = checkIsAddOn(parentProduct ?? product);

  if (!subscription) {
    return EMPTY_PRODUCT_BILLING_METADATA;
  }
  const billedCategory = getBilledCategory(subscription, product);

  if (!billedCategory) {
    return EMPTY_PRODUCT_BILLING_METADATA;
  }

  const billedCategoryInfo = getCategoryInfoFromPlural(billedCategory);

  let displayName = '';
  let addOnInfo = undefined;

  if (isAddOn) {
    const category = (parentProduct ?? product) as AddOnCategory;
    addOnInfo = subscription.addOns?.[category];
    if (!addOnInfo) {
      return EMPTY_PRODUCT_BILLING_METADATA;
    }
    displayName = parentProduct
      ? getPlanCategoryName({
          plan: subscription.planDetails,
          category: billedCategory,
          title: true,
        })
      : toTitleCase(addOnInfo.productName, {allowInnerUpperCase: true});
  } else {
    displayName = getPlanCategoryName({
      plan: subscription.planDetails,
      category: billedCategory,
      title: true,
    });
  }

  return {
    displayName,
    billedCategory,
    isAddOn,
    isEnabled: productIsEnabled(subscription, parentProduct ?? product),
    addOnInfo,
    usageExceeded: subscription.categories[billedCategory]?.usageExceeded ?? false,
    activeProductTrial: excludeProductTrials
      ? null
      : getActiveProductTrial(subscription.productTrials ?? null, billedCategory),
    potentialProductTrial: excludeProductTrials
      ? null
      : getPotentialProductTrial(subscription.productTrials ?? null, billedCategory),
    productLink:
      organization && billedCategoryInfo
        ? billedCategoryInfo.getProductLink?.(organization)
        : undefined,
  };
}
