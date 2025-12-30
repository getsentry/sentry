import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {useApiQuery} from 'sentry/utils/queryClient';

import {
  CronsBannerOnDemandCTA,
  CronsBannerUpgradeCTA,
} from 'getsentry/components/crons/cronsBannerUpgradeCTA';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {
  BillingConfig,
  MonitorCountResponse,
  Plan,
  Subscription,
} from 'getsentry/types';
import {displayBudgetName, getTrialDaysLeft} from 'getsentry/utils/billing';

interface Props {
  organization: Organization;
  subscription: Subscription;
}

interface CronsPricingInfo {
  onDemandPrice?: number;
  reserved?: number;
}

function getCronsPricingInfo(config?: BillingConfig): CronsPricingInfo {
  const bucket = config?.planList.find(plan => plan.id === 'am2_business')?.planCategories
    .monitorSeats?.[0];

  return {
    onDemandPrice: bucket?.onDemandPrice,
    reserved: bucket?.events,
  };
}

/** @internal exported for tests only */
export function CronsBillingBanner({organization, subscription}: Props) {
  const hasBillingAccess = organization.access.includes('org:billing');
  const trialDaysLeft = getTrialDaysLeft(subscription);
  const daysSinceTrial = getDaysSinceDate(subscription.lastTrialEnd ?? '');

  const {data: billingConfig} = useBillingConfig({organization, subscription});
  const {onDemandPrice, reserved} = getCronsPricingInfo(billingConfig);

  const queryKey = [`/organizations/${organization.slug}/monitor-count/`] as const;
  const {data, isPending} = useApiQuery<MonitorCountResponse>(queryKey, {
    staleTime: 0,
  });

  if (!data || isPending || !subscription.canSelfServe || !onDemandPrice || !reserved) {
    return null;
  }

  // Show alert for when we have disabled all monitors due to insufficient PAYG
  if (
    data.enabledMonitorCount === 0 &&
    data.overQuotaMonitorCount > 0 &&
    subscription.planDetails.allowOnDemand
  ) {
    return (
      <InsufficentOnDemandMonitorsDisabledBanner
        hasBillingAccess={hasBillingAccess}
        subscription={subscription}
      />
    );
  }

  // Subtract number of free monitors from active count
  const currentUsage = ((data.enabledMonitorCount - reserved) * onDemandPrice) / 100;
  if (currentUsage <= 0) {
    return null;
  }

  if (trialDaysLeft <= 7 && subscription.isTrial) {
    return (
      <TrialEndingBanner
        hasBillingAccess={hasBillingAccess}
        currentUsage={currentUsage}
        trialDaysLeft={trialDaysLeft}
        subscription={subscription}
      />
    );
  }

  // If the user's trial has ended and they aren't on a plan with PAYG
  if (
    daysSinceTrial >= 0 &&
    daysSinceTrial <= 7 &&
    !subscription.planDetails.allowOnDemand
  ) {
    return (
      <TrialEndedBanner
        hasBillingAccess={hasBillingAccess}
        plan={subscription.planDetails}
      />
    );
  }

  return null;
}

interface BannerProps {
  hasBillingAccess: boolean;
}

interface TrialEndingBannerProps extends BannerProps {
  currentUsage: number;
  trialDaysLeft: number;
}

function TrialEndingBanner({
  hasBillingAccess,
  currentUsage,
  trialDaysLeft,
  subscription,
}: TrialEndingBannerProps & {subscription: Subscription}) {
  const budgetType = subscription.planDetails.budgetTerm;
  return (
    <TrialBanner hasBillingAccess={hasBillingAccess}>
      {hasBillingAccess
        ? tct(
            "Your organization's free business trial ends in [trialDaysLeft]. To continue monitoring your cron jobs, make sure your [budgetType] budget is set to a minimum of $[currentUsage].",
            {
              trialDaysLeft: tn('%s day', '%s days', trialDaysLeft),
              currentUsage,
              budgetType,
            }
          )
        : tct(
            "Your organization's free business trial ends in [trialDaysLeft]. To continue monitoring your cron jobs, ask your organization's owner or billing manager to set an [budgetType] budget for cron monitoring.",
            {trialDaysLeft: tn('%s day', '%s days', trialDaysLeft), budgetType}
          )}
    </TrialBanner>
  );
}

function TrialEndedBanner({hasBillingAccess, plan}: BannerProps & {plan: Plan}) {
  return (
    <TrialBanner hasBillingAccess={hasBillingAccess}>
      {hasBillingAccess
        ? tct(
            'Your free business trial has ended. One cron job monitor is included in your current plan. If you want to monitor more than one cron job, please increase your [budgetTerm].',
            {budgetTerm: displayBudgetName(plan, {withBudget: true})}
          )
        : tct(
            "Your free business trial has ended. One cron job monitor is included in your current plan. If you want to monitor more than one cron job, please ask your organization's owner or billing manager to set up [budgetTerm] for cron monitoring.",
            {budgetTerm: displayBudgetName(plan)}
          )}
    </TrialBanner>
  );
}

function TrialBanner({
  hasBillingAccess,
  children,
}: BannerProps & {children?: React.ReactNode}) {
  return (
    <Alert.Container>
      <NoBorderRadiusAlert
        variant="warning"
        trailingItems={<CronsBannerUpgradeCTA hasBillingAccess={hasBillingAccess} />}
      >
        {children}
      </NoBorderRadiusAlert>
    </Alert.Container>
  );
}

function InsufficentOnDemandMonitorsDisabledBanner({
  hasBillingAccess,
  subscription,
}: BannerProps & {subscription: Subscription}) {
  const budgetType = subscription.planDetails.budgetTerm;
  return (
    <Alert.Container>
      <NoBorderRadiusAlert
        variant="warning"
        trailingItems={
          <CronsBannerOnDemandCTA
            hasBillingAccess={hasBillingAccess}
            subscription={subscription}
          />
        }
      >
        {hasBillingAccess
          ? tct(
              "Your organization doesn't have sufficient [budgetType] budget to cover your active cron job monitors. To continue monitoring your jobs, increase your [budgetType] budget or reduce your active monitors.",
              {budgetType}
            )
          : tct(
              "Your organization doesn't have sufficient [budgetType] budget to cover your active cron job monitors. To continue monitoring your jobs, ask your organization's owner or billing manager to increase your [budgetType] budget or reduce your active monitors.",
              {budgetType}
            )}
      </NoBorderRadiusAlert>
    </Alert.Container>
  );
}

export default withSubscription(CronsBillingBanner, {
  noLoader: true,
});

const NoBorderRadiusAlert = styled(Alert)`
  border-radius: 0;
`;
