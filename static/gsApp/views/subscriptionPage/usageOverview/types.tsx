import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {AddOnCategory, CustomerUsage, Subscription} from 'getsentry/types';

interface UsageOverviewProps {
  organization: Organization;
  subscription: Subscription;
  usageData: CustomerUsage;
}

export interface BreakdownPanelProps extends UsageOverviewProps {
  selectedProduct: DataCategory | AddOnCategory;
  isInline?: boolean;
}
