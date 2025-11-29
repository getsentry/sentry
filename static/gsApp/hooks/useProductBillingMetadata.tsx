import type {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {AddOn, AddOnCategory, ProductTrial, Subscription} from 'getsentry/types';
import {
  checkIsAddOn,
  getActiveProductTrial,
  getBilledCategory,
  getPotentialProductTrial,
  productIsEnabled,
} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';

interface ProductBillingMetadata {
  activeProductTrial: ProductTrial | null;
  billedCategory: DataCategory | null;
  displayName: string;
  isAddOn: boolean;
  isEnabled: boolean;
  potentialProductTrial: ProductTrial | null;
  usageExceeded: boolean;
  addOnInfo?: AddOn;
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
  subscription: Subscription,
  product: DataCategory | AddOnCategory,
  parentProduct?: DataCategory | AddOnCategory,
  excludeProductTrials?: boolean
): ProductBillingMetadata {
  const isAddOn = checkIsAddOn(parentProduct ?? product);
  const billedCategory = getBilledCategory(subscription, product);

  if (!billedCategory) {
    return EMPTY_PRODUCT_BILLING_METADATA;
  }

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
  };
}
