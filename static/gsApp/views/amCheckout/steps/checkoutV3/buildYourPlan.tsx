import {useMemo} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

import {ANNUAL} from 'getsentry/constants';
import type {BillingConfig, Plan, PlanTier, Subscription} from 'getsentry/types';
import {
  getPlanIcon,
  isBizPlanFamily,
  isDeveloperPlan,
  isNewPayingCustomer,
  isTeamPlanFamily,
  isTrialPlan,
} from 'getsentry/utils/billing';
import BillingCycleSelectCard from 'getsentry/views/amCheckout/billingCycleSelectCard';
import ReserveAdditionalVolume from 'getsentry/views/amCheckout/reserveAdditionalVolume';
import {getHighlightedFeatures} from 'getsentry/views/amCheckout/steps/planSelect';
import PlanSelectCard from 'getsentry/views/amCheckout/steps/planSelectCard';
import ProductSelect from 'getsentry/views/amCheckout/steps/productSelect';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {
  CheckoutFormData,
  CheckoutV3StepProps,
  PlanContent,
} from 'getsentry/views/amCheckout/types';
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
  referrer?: string;
}

interface AdditionalProductsSubstepProps extends BaseSubstepProps {}

interface BillingCycleSubstepProps extends BaseSubstepProps {
  billingConfig: BillingConfig;
  subscription: Subscription;
}

function PlanSubstep({
  billingConfig,
  activePlan,
  formData,
  subscription,
  organization,
  referrer,
  checkoutTier,
  onUpdate,
}: PlanSubstepProps) {
  const planOptions = useMemo(() => {
    const plans = billingConfig.planList.filter(
      ({contractInterval}) => contractInterval === activePlan.contractInterval
    );

    if (plans.length === 0) {
      throw new Error('Cannot get plan options');
    }

    // sort by price ascending
    return plans.sort((a, b) => a.basePrice - b.basePrice);
  }, [billingConfig, activePlan.contractInterval]);

  const bizPlanContent: PlanContent = useMemo(() => {
    const bizPlan = billingConfig.planList.find(p => isBizPlanFamily(p));
    if (!bizPlan) {
      return {
        description: '',
        features: {},
      };
    }
    return utils.getContentForPlan(bizPlan);
  }, [billingConfig]);

  const getBadge = (plan: Plan): React.ReactNode | undefined => {
    if (
      plan.id === subscription.plan ||
      // TODO(checkout v3): Test this once Developer is surfaced
      (isTrialPlan(subscription.plan) && isDeveloperPlan(plan))
    ) {
      // TODO(checkout v3): Replace with custom badge
      const copy = t('Current');
      return <Tag type="info">{copy}</Tag>;
    }

    if (
      isBizPlanFamily(plan) &&
      subscription.lastTrialEnd &&
      !isBizPlanFamily(subscription.planDetails)
    ) {
      const lastTrialEnd = moment(subscription.lastTrialEnd).utc().fromNow();
      const trialExpired: boolean = getDaysSinceDate(subscription.lastTrialEnd) > 0;
      return (
        <Tag type="info">
          {subscription.isTrial && !trialExpired
            ? tct('Trial expires [lastTrialEnd]', {lastTrialEnd})
            : t('You trialed this plan')}
        </Tag>
      );
    }
    return undefined;
  };

  return (
    <Substep>
      <SubstepTitle>{t('Choose one')}</SubstepTitle>
      <OptionGrid columns={planOptions.length}>
        {planOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const shouldShowDefaultPayAsYouGo = isNewPayingCustomer(
            subscription,
            organization
          );
          const planIndex = planOptions.indexOf(plan);
          const priorPlan = planIndex > 0 ? planOptions[planIndex - 1] : undefined;
          const basePrice = utils.formatPrice({cents: plan.basePrice}); // TODO(isabella): confirm discountInfo is no longer used

          let planContent = utils.getContentForPlan(plan);
          const highlightedFeatures = getHighlightedFeatures(referrer);

          // Additional members is available on any paid plan
          // but it's so impactful it doesn't hurt to add it in for the business plan
          // if the user is coming from a deactivated member header CTA
          if (isBizPlanFamily(plan) && referrer === 'deactivated_member_header') {
            highlightedFeatures.push('deactivated_member_header');
            planContent = cloneDeep(planContent);
            planContent.features.deactivated_member_header = t('Unlimited members');
          }

          let missingFeatures: string[] = [];
          if (isTeamPlanFamily(plan) && isSelected) {
            missingFeatures = getHighlightedFeatures(referrer).filter(
              feature => !planContent.features[feature]
            );
          }

          const planIcon = getPlanIcon(plan);
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
              highlightedFeatures={highlightedFeatures}
              planIcon={planIcon}
              shouldShowDefaultPayAsYouGo={shouldShowDefaultPayAsYouGo}
              shouldShowEventPrice={!!isBizPlanFamily(plan)}
              priorPlan={priorPlan}
              badge={badge}
              missingFeatures={missingFeatures}
              upsellPlanContent={bizPlanContent}
            />
          );
        })}
      </OptionGrid>
      <ReserveAdditionalVolume
        activePlan={activePlan}
        formData={formData}
        onUpdate={onUpdate}
        organization={organization}
        subscription={subscription}
        checkoutTier={checkoutTier}
      />
    </Substep>
  );
}

function AdditionalProductsSubstep({
  activePlan,
  formData,
  onUpdate,
}: AdditionalProductsSubstepProps) {
  return (
    <Substep>
      <SubstepTitle>{t('Select additional products')}</SubstepTitle>
      <ProductSelect
        activePlan={activePlan}
        formData={formData}
        onUpdate={onUpdate}
        isNewCheckout
      />
    </Substep>
  );
}

function BillingCycleSubstep({
  formData,
  onUpdate,
  subscription,
  billingConfig,
}: BillingCycleSubstepProps) {
  const intervalOptions = useMemo(() => {
    const basePlan = formData.plan.replace('_auf', '');
    const plans = billingConfig.planList.filter(({id}) => id.indexOf(basePlan) === 0);

    if (plans.length === 0) {
      throw new Error('Cannot get billing interval options');
    }

    return plans;
  }, [billingConfig, formData.plan]);

  let previousPlanPrice = 0;
  return (
    <Substep>
      <SubstepHeader>
        <SubstepTitle>{t('Billing cycle')}</SubstepTitle>
        <SubstepDescription>
          {t('Additional usage is billed separately, at the start of the next cycle')}
        </SubstepDescription>
      </SubstepHeader>
      <OptionGrid columns={intervalOptions.length}>
        {intervalOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const isAnnual = plan.contractInterval === ANNUAL;
          const priceAfterDiscount = utils.getReservedPriceCents({
            plan,
            reserved: formData.reserved,
            selectedProducts: formData.selectedProducts,
          });
          const formattedPriceAfterDiscount = utils.formatPrice({
            cents: priceAfterDiscount,
          });

          const priceBeforeDiscount = isAnnual ? previousPlanPrice * 12 : 0;
          const formattedPriceBeforeDiscount = previousPlanPrice
            ? utils.formatPrice({cents: priceBeforeDiscount})
            : '';
          previousPlanPrice = priceAfterDiscount;

          return (
            <BillingCycleSelectCard
              key={plan.id}
              plan={plan}
              isSelected={isSelected}
              onUpdate={onUpdate}
              subscription={subscription}
              formattedPriceAfterDiscount={formattedPriceAfterDiscount}
              formattedPriceBeforeDiscount={formattedPriceBeforeDiscount}
              priceAfterDiscount={priceAfterDiscount}
            />
          );
        })}
      </OptionGrid>
    </Substep>
  );
}

function BuildYourPlan({
  activePlan,
  billingConfig,
  organization,
  subscription,
  formData,
  referrer,
  onEdit,
  onUpdate,
  stepNumber,
  checkoutTier,
}: CheckoutV3StepProps) {
  return (
    <BuildYourPlanContainer>
      <StepHeader
        isActive
        isCompleted={false}
        onEdit={onEdit}
        stepNumber={stepNumber}
        title={t('Build your plan')}
        isNewCheckout
      />
      <PlanSubstep
        activePlan={activePlan}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={onUpdate}
        organization={organization}
        referrer={referrer}
        subscription={subscription}
        checkoutTier={checkoutTier}
      />
      <AdditionalProductsSubstep
        activePlan={activePlan}
        formData={formData}
        onUpdate={onUpdate}
      />
      <BillingCycleSubstep
        activePlan={activePlan}
        formData={formData}
        onUpdate={onUpdate}
        subscription={subscription}
        billingConfig={billingConfig}
      />
    </BuildYourPlanContainer>
  );
}

export default BuildYourPlan;

const BuildYourPlanContainer = styled('div')``;

const Substep = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};
`;

const SubstepTitle = styled('h2')`
  font-size: ${p => p.theme.fontSize.md};
  margin-top: ${p => p.theme.space['2xl']};
  margin-bottom: 0;
`;

const SubstepDescription = styled('p')`
  margin: 0;
  color: ${p => p.theme.subText};
`;

const SubstepHeader = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const OptionGrid = styled('div')<{columns: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, 1fr);
  column-gap: ${p => p.theme.space.xl};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(1, 1fr);
    row-gap: ${p => p.theme.space.xl};
  }
`;
