import {Alert} from 'sentry/components/core/alert';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {MonitorCountResponse, Plan, Subscription} from 'getsentry/types';
import {isEnterprise} from 'getsentry/utils/billing';
import formatCurrency from 'getsentry/utils/formatCurrency';

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
  let reserved: number | null | undefined;
  let cronsPrice: number | null | undefined;
  if (isEnterprise(activePlan.id)) {
    // this can only be reached for enterprise customers with invoiced PAYG
    // we want to make sure we use their actual reserved amount and not the minimum
    // for enterprise plans
    reserved = subscription.categories[cronCategoryName]?.reserved;
    cronsPrice = subscription.categories[cronCategoryName]?.paygCpe;
  } else {
    reserved = cronsBucket?.events;
    cronsPrice = cronsBucket?.onDemandPrice;
  }

  const queryKey = [`/organizations/${organization.slug}/monitor-count/`] as const;
  const {data, isPending} = useApiQuery<MonitorCountResponse>(queryKey, {
    staleTime: 0,
  });

  if (isPending || !data || !cronsPrice || reserved === undefined || reserved === null) {
    return null;
  }

  const numCrons = data.enabledMonitorCount;
  const currentSpend = (numCrons - reserved) * cronsPrice;
  const overBudget = currentSpend > currentOnDemand;

  if (!overBudget) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="warning">
        {tct(
          "These changes will take effect at the start of your next billing cycle. Heads up that you're currently using [currentSpend] of Cron Monitors. These monitors will be turned off at the start of your next billing cycle unless you increase your [budgetType] budget.",
          {
            currentSpend: formatCurrency(currentSpend),
            budgetType: subscription.planDetails.budgetTerm,
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
