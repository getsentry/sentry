import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Grid} from 'sentry/components/core/layout';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

import type {BillingConfig, Plan, PlanTier, Subscription} from 'getsentry/types';
import {
  getPlanIcon,
  isBizPlanFamily,
  isDeveloperPlan,
  isNewPayingCustomer,
  isTrialPlan,
} from 'getsentry/utils/billing';
import PlanFeatures from 'getsentry/views/amCheckout/planFeatures';
import {getHighlightedFeatures} from 'getsentry/views/amCheckout/steps/planSelect';
import PlanSelectCard from 'getsentry/views/amCheckout/steps/planSelectCard';
import ProductSelect from 'getsentry/views/amCheckout/steps/productSelect';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {
  CheckoutFormData,
  CheckoutV3StepProps,
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

function PlanSubstep({
  billingConfig,
  activePlan,
  formData,
  subscription,
  organization,
  referrer,
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

  const getBadge = (plan: Plan): React.ReactNode | undefined => {
    if (
      plan.id === subscription.plan ||
      // TODO(checkout v3): Test this once Developer is surfaced
      (isTrialPlan(subscription.plan) && isDeveloperPlan(plan))
    ) {
      // TODO(checkout v3): Replace with custom badge
      const copy = t('Current');
      return <Tag type="default">{copy}</Tag>;
    }

    if (
      isBizPlanFamily(plan) &&
      subscription.lastTrialEnd &&
      !isBizPlanFamily(subscription.planDetails)
    ) {
      const lastTrialEnd = moment(subscription.lastTrialEnd).utc().fromNow();
      const trialExpired: boolean = getDaysSinceDate(subscription.lastTrialEnd) > 0;
      return (
        <Tag type="warning">
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
      <OptionGrid columns={planOptions.length}>
        {planOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const shouldShowDefaultPayAsYouGo = isNewPayingCustomer(
            subscription,
            organization
          );
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
              badge={badge}
            />
          );
        })}
      </OptionGrid>
      <PlanFeatures planOptions={planOptions} activePlan={activePlan} />
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
      <Grid columns={{sm: '1fr', md: '1fr 1fr'}} gap="xl">
        <ProductSelect
          activePlan={activePlan}
          formData={formData}
          onUpdate={onUpdate}
          isNewCheckout
        />
      </Grid>
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
  const [isOpen, setIsOpen] = useState(true);

  return (
    <BuildYourPlanContainer>
      <StepHeader
        isActive
        isCompleted={false}
        onEdit={onEdit}
        onToggleStep={setIsOpen}
        isOpen={isOpen}
        stepNumber={stepNumber}
        title={t('Build your plan')}
        isNewCheckout
      />
      {isOpen && (
        <Fragment>
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
        </Fragment>
      )}
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
  margin-top: ${p => p.theme.space['3xl']};
`;

const SubstepTitle = styled('h2')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-top: ${p => p.theme.space['2xl']};
  margin-bottom: 0;
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
