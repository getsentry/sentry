import {useMemo} from 'react';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getDaysSinceDate} from 'sentry/utils/getDaysSinceDate';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {
  OnDemandBudgetMode,
  type BillingConfig,
  type Plan,
  type Subscription,
} from 'getsentry/types';
import {
  formatPrice,
  isBizPlanFamily,
  isDeveloperPlan,
  isNewPayingCustomer,
  isTrial,
} from 'getsentry/utils/billing';
import {PlanFeatures} from 'getsentry/views/amCheckout/components/planFeatures';
import {StepHeader} from 'getsentry/views/amCheckout/components/stepHeader';
import {ProductSelect} from 'getsentry/views/amCheckout/steps/productSelect';
import type {CheckoutFormData, StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

interface BaseSubstepProps {
  activePlan: Plan;
  formData: CheckoutFormData;
  onUpdate: (data: Partial<CheckoutFormData>) => void;
}

interface PlanSubstepProps extends BaseSubstepProps {
  billingConfig: BillingConfig;
  organization: Organization;
  subscription: Subscription;
}

interface AdditionalProductsSubstepProps extends BaseSubstepProps {
  subscription: Subscription;
}

function PlanSubstep({
  billingConfig,
  activePlan,
  formData,
  subscription,
  organization,
  onUpdate,
}: PlanSubstepProps) {
  const planOptions = useMemo(() => {
    const plans = billingConfig.planList.filter(
      ({billingInterval, id}) =>
        billingInterval === activePlan.billingInterval &&
        !id.includes(billingConfig.freePlan) // TODO(billing): If we ever surface Developer in checkout, we'll need to remove this filter
    );

    if (plans.length === 0) {
      throw new Error('Cannot get plan options');
    }

    // sort by price ascending
    return plans.sort((a, b) => a.basePrice - b.basePrice);
  }, [billingConfig, activePlan.billingInterval]);

  const getBadge = (plan: Plan): React.ReactNode | undefined => {
    if (
      plan.id === subscription.plan ||
      // If Developer is surfaced in checkout and the current plan is a trial plan, we should show the `Current` badge
      // on the Developer plan
      (subscription.onTrialPlan && isDeveloperPlan(plan))
    ) {
      const copy = t('Current');
      return <Tag variant="muted">{copy}</Tag>;
    }

    if (
      isBizPlanFamily(plan) &&
      subscription.lastTrialEnd &&
      !isBizPlanFamily(subscription.planDetails)
    ) {
      const lastTrialEnd = moment(subscription.lastTrialEnd).utc().fromNow();
      const trialExpired = getDaysSinceDate(subscription.lastTrialEnd) > 0;
      return (
        <Tag variant="warning">
          {isTrial(subscription) && !trialExpired
            ? tct('Trial expires [lastTrialEnd]', {lastTrialEnd})
            : t('You trialed this plan')}
        </Tag>
      );
    }
    return undefined;
  };

  return (
    <Stack gap="xl">
      <Grid
        columns={{zero: '1fr', '4xl': `repeat(${planOptions.length}, 1fr)`}}
        gap="lg"
        role="radiogroup"
        aria-label={t('Plan')}
      >
        {planOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const shouldShowDefaultPayAsYouGo = isNewPayingCustomer(
            subscription,
            organization
          );
          const basePrice = formatPrice({cents: plan.basePrice});
          const planContent = utils.getContentForPlan(plan);
          const badge = getBadge(plan);
          const billingInterval = utils.getShortInterval(plan.billingInterval);

          return (
            <ToggleCard
              key={plan.id}
              variant="radio"
              name="checkout-plan"
              value={plan.id}
              checked={isSelected}
              data-test-id={`plan-option-${plan.id}`}
              aria-label={plan.name}
              onChange={() => {
                const data: Partial<CheckoutFormData> = {plan: plan.id};
                if (shouldShowDefaultPayAsYouGo) {
                  data.onDemandMaxSpend = isBizPlanFamily(plan)
                    ? PAYG_BUSINESS_DEFAULT
                    : PAYG_TEAM_DEFAULT;
                  data.onDemandBudget = {
                    budgetMode: OnDemandBudgetMode.SHARED,
                    sharedMaxBudget: data.onDemandMaxSpend,
                  };
                }
                onUpdate(data);
              }}
            >
              <Flex align="start" gap="md">
                <ToggleCard.Indicator />
                <Stack gap="sm" flexGrow={1}>
                  <Flex align="center" justify="between" gap="sm">
                    <Flex align="center" gap="sm">
                      <Heading as="h3" variant="primary">
                        {plan.name}
                      </Heading>
                      {badge}
                    </Flex>
                    <Flex>
                      <Text size="lg" bold>{`$${basePrice}`}</Text>
                      <Text size="lg" variant="muted">{`/${billingInterval}`}</Text>
                    </Flex>
                  </Flex>
                  <Text size="md" variant="muted" textWrap="balance">
                    {planContent.description}
                  </Text>
                </Stack>
              </Flex>
            </ToggleCard>
          );
        })}
      </Grid>
      <PlanFeatures planOptions={planOptions} activePlan={activePlan} />
    </Stack>
  );
}

function AdditionalProductsSubstep({
  activePlan,
  formData,
  onUpdate,
  subscription,
}: AdditionalProductsSubstepProps) {
  return (
    <Stack gap="xl" paddingTop="3xl">
      <Stack gap="xl">
        <ProductSelect
          activePlan={activePlan}
          formData={formData}
          onUpdate={onUpdate}
          subscription={subscription}
        />
      </Stack>
    </Stack>
  );
}

export function BuildYourPlan({
  activePlan,
  billingConfig,
  organization,
  subscription,
  formData,
  onUpdate,
  stepNumber,
}: StepProps) {
  return (
    <Stack gap="xl" direction="column" id={`step${stepNumber}`}>
      <StepHeader title={t('Select a plan')} />
      <PlanSubstep
        activePlan={activePlan}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={onUpdate}
        organization={organization}
        subscription={subscription}
      />
      <AdditionalProductsSubstep
        activePlan={activePlan}
        formData={formData}
        onUpdate={onUpdate}
        subscription={subscription}
      />
    </Stack>
  );
}
