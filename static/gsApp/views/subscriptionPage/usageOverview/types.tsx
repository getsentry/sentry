import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {AddOnCategory, CustomerUsage, Subscription} from 'getsentry/types';

export interface UsageOverviewProps {
  organization: Organization;
  subscription: Subscription;
  usageData: CustomerUsage;
}

export interface BreakdownPanelProps extends UsageOverviewProps {
  selectedProduct: DataCategory | AddOnCategory;
  isInline?: boolean;
}

export interface UsageOverviewTableProps extends Omit<BreakdownPanelProps, 'isInline'> {
  onRowClick: (category: DataCategory | AddOnCategory) => void;
}
