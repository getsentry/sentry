import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

// Note: This does not fully represent the actual Subscription type.
// Contains only the subset of attributes that we used in the hook.
type Subscription = {
  categories:
    | {
        transactions: {
          usageExceeded: boolean;
        };
      }
    | {
        spans: {
          usageExceeded: boolean;
        };
      }
    | {
        logBytes: {
          usageExceeded: boolean;
        };
      }
    | {
        traceMetrics: {
          usageExceeded: boolean;
        };
      };
  planDetails: {
    billingInterval: 'monthly' | 'annual';
    budgetTerm: 'pay-as-you-go' | 'on-demand';
  };
  planTier: string;
  onDemandBudgets?: {
    enabled: boolean;
  };
};

export function usePerformanceSubscriptionDetails({
  traceItemDataset,
}: {
  // Default refers to the existing behaviour for either spans or transactions.
  // Otherwise used to discern exactly which usage limit was exceeded in explore pages.
  traceItemDataset: 'logs' | 'metrics' | 'default';
}) {
  const organization = useOrganization();

  const {data: subscription, ...rest} = useApiQuery<Subscription>(
    [`/subscriptions/${organization.slug}/`],
    {
      staleTime: Infinity,
    }
  );

  const hasExceededPerformanceUsageLimit = subscriptionHasExceededPerformanceUsageLimit(
    subscription,
    traceItemDataset
  );

  return {
    ...rest,
    data: {
      hasExceededPerformanceUsageLimit,
      subscription,
    },
  };
}

function subscriptionHasExceededPerformanceUsageLimit(
  subscription: Subscription | undefined,
  traceItemDataset: 'logs' | 'metrics' | 'default'
) {
  let hasExceededExploreItemUsageLimit = false;
  const dataCategories = subscription?.categories;
  if (dataCategories) {
    if (traceItemDataset === 'logs') {
      if ('logBytes' in dataCategories) {
        hasExceededExploreItemUsageLimit =
          dataCategories.logBytes?.usageExceeded || false;
      }
    } else if (traceItemDataset === 'metrics') {
      if ('traceMetrics' in dataCategories) {
        hasExceededExploreItemUsageLimit =
          dataCategories.traceMetrics?.usageExceeded || false;
      }
    } else if (traceItemDataset === 'default') {
      if ('transactions' in dataCategories) {
        hasExceededExploreItemUsageLimit =
          dataCategories.transactions?.usageExceeded || false;
      } else if ('spans' in dataCategories) {
        hasExceededExploreItemUsageLimit = dataCategories.spans?.usageExceeded || false;
      }
    }
  }
  return hasExceededExploreItemUsageLimit;
}
