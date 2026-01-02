import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import DateRangeQueryLimitFooter from 'getsentry/components/features/dateRangeQueryLimitFooter';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Subscription} from 'getsentry/types';

interface Props {
  organization: Organization;
  subscription: Subscription;
}

const DESCRIPTION = t(
  'To view more trends for your Performance data, upgrade to Business.'
);

const QUERY_LIMIT_REFERRER = 'insights-query-limit-footer';

export function InsightsDateRangeQueryLimitFooter({organization, subscription}: Props) {
  const shouldShowQueryLimitFooter = useHasRequiredFeatures(organization, subscription);

  if (!shouldShowQueryLimitFooter) {
    return null;
  }

  return (
    <DateRangeQueryLimitFooter description={DESCRIPTION} source={QUERY_LIMIT_REFERRER} />
  );
}

const useHasRequiredFeatures = (
  organization: Organization,
  subscription: Subscription
) => {
  const {data: billingConfig} = useBillingConfig({organization, subscription});
  const subscriptionPlan = subscription.planDetails;
  const subscriptionPlanFeatures = subscriptionPlan?.features ?? [];

  const trialPlan = subscription.trialPlan
    ? billingConfig?.planList?.find(plan => plan.id === subscription.trialPlan)
    : undefined;
  const trialPlanFeatures = trialPlan?.features ?? [];

  const enabledFeatures = [
    ...new Set([
      ...subscriptionPlanFeatures,
      ...trialPlanFeatures,
      ...organization.features,
    ]),
  ];
  return enabledFeatures.includes('insights-query-date-range-limit');
};

export default withOrganization(
  withSubscription(InsightsDateRangeQueryLimitFooter, {noLoader: true})
);
