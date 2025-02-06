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
      };
  planDetails: {
    billingInterval: 'monthly' | 'annual';
  };
  planTier: string;
  onDemandBudgets?: {
    enabled: boolean;
  };
};

export function usePerformanceSubscriptionDetails() {
  const organization = useOrganization();

  const {data: subscription, ...rest} = useApiQuery<Subscription>(
    [`/subscriptions/${organization.slug}/`],
    {
      staleTime: Infinity,
    }
  );

  let hasExceededPerformanceUsageLimit: boolean | null = null;

  const dataCategories = subscription?.categories;
  if (dataCategories) {
    if ('transactions' in dataCategories) {
      hasExceededPerformanceUsageLimit =
        dataCategories.transactions.usageExceeded || false;
    } else if ('spans' in dataCategories) {
      hasExceededPerformanceUsageLimit = dataCategories.spans.usageExceeded || false;
    }
  }

  return {
    ...rest,
    data: {
      hasExceededPerformanceUsageLimit,
      subscription,
    },
  };
}
