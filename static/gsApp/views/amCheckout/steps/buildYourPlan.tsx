import {useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex, Stack} from 'sentry/components/core/layout';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

import type {BillingConfig, Plan, PlanTier, Subscription} from 'getsentry/types';
import {
  isBizPlanFamily,
  isDeveloperPlan,
  isNewPayingCustomer,
  isTrialPlan,
} from 'getsentry/utils/billing';
import PlanFeatures from 'getsentry/views/amCheckout/components/planFeatures';
import PlanSelectCard from 'getsentry/views/amCheckout/components/planSelectCard';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import ProductSelect from 'getsentry/views/amCheckout/steps/productSelect';
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
  checkoutTier?: PlanTier;
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
    // TODO(isabella): Remove this once Developer is surfaced
    const plans = billingConfig.planList.filter(
      ({contractInterval, id}) =>
        contractInterval === activePlan.contractInterval &&
        !id.includes(billingConfig.freePlan)
    );

    if (plans.length === 0) {
      throw new Error('Cannot get plan options');
    }

    // sort by price ascending
    return plans.sort((a, b) => a.basePrice - b.basePrice);
  }, [billingConfig, activePlan.contractInterval]);

  const getBadge = (plan: Plan): React.ReactNode | undefined => {
    if (
      plan.id === subscription.plan ||
      // TODO(billing): Test this once Developer is surfaced
      (isTrialPlan(subscription.plan) && isDeveloperPlan(plan))
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
      const trialExpired: boolean = getDaysSinceDate(subscription.lastTrialEnd) > 0;
      return (
        <Tag variant="warning">
          {subscription.isTrial && !trialExpired
            ? tct('Trial expires [lastTrialEnd]', {lastTrialEnd})
            : t('You trialed this plan')}
        </Tag>
      );
    }
    return undefined;
  };

  return (
    <Flex direction="column" gap="xl">
      <OptionGrid columns={planOptions.length}>
        {planOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const shouldShowDefaultPayAsYouGo = isNewPayingCustomer(
            subscription,
            organization
          );
          const basePrice = utils.formatPrice({cents: plan.basePrice}); // TODO(isabella): confirm discountInfo is no longer used
          const planContent = utils.getContentForPlan(plan);
          const badge = getBadge(plan);

          return (
            <PlanSelectCard
              key={plan.id}
              plan={plan}
              isSelected={isSelected}
              onUpdate={onUpdate}
              planValue={plan.name}
              planName={plan.name}
              price={basePrice}
              planContent={planContent}
              shouldShowDefaultPayAsYouGo={shouldShowDefaultPayAsYouGo}
              badge={badge}
            />
          );
        })}
      </OptionGrid>
      <PlanFeatures planOptions={planOptions} activePlan={activePlan} />
    </Flex>
  );
}

function AdditionalProductsSubstep({
  activePlan,
  formData,
  onUpdate,
  subscription,
}: AdditionalProductsSubstepProps) {
  return (
    <Flex direction="column" gap="xl" paddingTop="3xl">
      <Flex direction="column" gap="xl">
        <ProductSelect
          activePlan={activePlan}
          formData={formData}
          onUpdate={onUpdate}
          subscription={subscription}
        />
      </Flex>
    </Flex>
  );
}

function BuildYourPlan({
  activePlan,
  billingConfig,
  organization,
  subscription,
  formData,
  onUpdate,
  stepNumber,
  checkoutTier,
}: StepProps) {
  return (
    <Stack gap="xl" direction="column">
      <StepHeader stepNumber={stepNumber} title={t('Select a plan')} />
      <PlanSubstep
        activePlan={activePlan}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={onUpdate}
        organization={organization}
        subscription={subscription}
        checkoutTier={checkoutTier}
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

export default BuildYourPlan;

const OptionGrid = styled('div')<{columns: number}>`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${p => p.theme.space.lg};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(${p => p.columns}, 1fr);
    row-gap: ${p => p.theme.space.xl};
  }
`;
