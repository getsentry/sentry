import {Alert} from 'sentry/components/alert';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import {
  type MonitorCountResponse,
  type Plan,
  PlanTier,
  type Subscription,
} from 'getsentry/types';

interface Props {
  activePlan: Plan;
  currentOnDemand: number;
  // TODO(davidenwang): Once modals have access to OrganizationContext, delete this in favor of useOrganization
  organization: Organization;
  subscription: Subscription;
}

export function CronsOnDemandStepWarning({
  currentOnDemand,
  activePlan,
  organization,
  subscription,
}: Props) {
  const cronCategoryName = DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT].plural;
  const cronsBucket = activePlan.planCategories[cronCategoryName]?.[0];
  const cronsPrice = cronsBucket?.onDemandPrice;
  const reserved = cronsBucket?.events;

  const queryKey = [`/organizations/${organization.slug}/monitor-count/`] as const;
  const {data, isPending} = useApiQuery<MonitorCountResponse>(queryKey, {
    staleTime: 0,
  });

  if (isPending || !data || !cronsPrice || !reserved) {
    return null;
  }

  const numCrons = data.enabledMonitorCount;
  const currentUsage = (numCrons - reserved) * cronsPrice;
  const overBudget = currentUsage > currentOnDemand;

  if (!overBudget) {
    return null;
  }

  return (
    <Alert type="warning" showIcon>
      {tct(
        "These changes will take effect at the start of your next billing cycle. Heads up that you're currently using $[currentUsageDollars] of Cron Monitors. These monitors will be turned off at the start of your next billing cycle unless you increase your [budgetType] budget.",
        {
          currentUsageDollars: currentUsage / 100,
          budgetType:
            subscription.planTier === PlanTier.AM3 ? 'pay-as-you-go' : 'on-demand',
        }
      )}
    </Alert>
  );
}
