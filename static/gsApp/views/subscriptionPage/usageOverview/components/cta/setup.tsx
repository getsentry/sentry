import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import type {AddOnCategory, Subscription} from 'getsentry/types';

interface SetupCtaProps {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
}

function SetupCta({organization, subscription, selectedProduct}: SetupCtaProps) {
  const {billedCategoryInfo, isEnabled} = useProductBillingMetadata(
    subscription,
    selectedProduct
  );

  if (!isEnabled) {
    return false;
  }
}
