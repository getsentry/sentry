import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {Oxfordize} from 'sentry/utils/oxfordizeArray';

import {PlanTier, type Plan} from 'getsentry/types';
import {
  getBusinessPlanOfTier,
  isBizPlanFamily,
  isNewPayingCustomer,
  isTeamPlan,
  isTeamPlanFamily,
} from 'getsentry/utils/billing';
import {
  checkForPromptBasedPromotion,
  showSubscriptionDiscount,
} from 'getsentry/utils/promotionUtils';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import usePromotionTriggerCheck from 'getsentry/utils/usePromotionTriggerCheck';
import PlanSelectRow from 'getsentry/views/amCheckout/components/planSelectRow';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import ProductSelect from 'getsentry/views/amCheckout/steps/productSelect';
import type {PlanContent, StepProps} from 'getsentry/views/amCheckout/types';
import {
  formatPrice,
  getContentForPlan,
  getDiscountedPrice,
} from 'getsentry/views/amCheckout/utils';

const REFERRER_FEATURE_HIGHLIGHTS = {
  'upgrade-business-landing.sso': ['saml'],
  'upgrade-business-landing.relay': ['advanced_filtering'],
  'upgrade-business-landing.feature.relay': ['advanced_filtering'],
  'upgrade-business-landing.discover-query': ['discover'],
  'upgrade-business-landing.discover-saved-query': ['discover'],
  'upgrade-business-landing.discover2': ['discover'],
  'upgrade-business-landing.custom-dashboards': ['dashboard'],
  'upgrade-business-landing.dashboards-edit': ['dashboard'],
  'upgrade-business-landing.feature.auth_provider.saml2': ['saml'],
  'upsell-dashboards': ['dashboard'],
  'upsell-discover2': ['discover'],
};

function getHighlightedFeatures(referrer?: string): string[] {
  return referrer
    ? (REFERRER_FEATURE_HIGHLIGHTS[
        referrer as keyof typeof REFERRER_FEATURE_HIGHLIGHTS
      ] ?? [])
    : [];
}

/**
 * Filter plans by the active plan billing interval so
 * monthly or annual plans are displayed
 */
function getPlanOptions({
  billingConfig,
  activePlan,
}: Pick<StepProps, 'billingConfig' | 'activePlan'>) {
  let plans = billingConfig.planList.filter(
    ({id, billingInterval}) =>
      billingInterval === activePlan.billingInterval && id !== billingConfig.freePlan
  );

  plans = plans.sort((a, b) => b.basePrice - a.basePrice);

  if (plans.length === 0) {
    throw new Error('Cannot get plan options by interval');
  }
  return plans;
}

/**
 * Filter plans by the active plan billing interval so
 * monthly or annual plans are displayed
 */
function PlanSelect({
  promotion,
  activePlan,
  billingConfig,
  isActive,
  stepNumber,
  isCompleted,
  checkoutTier,
  organization,
  subscription,
  formData,
  referrer,
  onEdit,
  onToggleLegacy,
  onUpdate,
  onCompleteStep,
}: StepProps) {
  const {data: promotionData, refetch} = usePromotionTriggerCheck(organization);
  const discountInfo = promotion?.discountInfo;
  let trailingItems: React.ReactNode = null;
  if (showSubscriptionDiscount({activePlan, discountInfo}) && discountInfo) {
    const percent = discountInfo.amount / 100;
    trailingItems = (
      <Tag type="promotion">
        {tct('[durationText] [percent]% off', {
          percent,
          durationText: discountInfo.durationText,
        })}
      </Tag>
    );
  }

  const getBadge = (plan: Plan): React.ReactNode | undefined => {
    if (plan.id === subscription.plan) {
      return <Tag type="info">{t('Current plan')}</Tag>;
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

  const renderBody = () => {
    const shouldShowDefaultPayAsYouGo =
      isNewPayingCustomer(subscription, organization) && checkoutTier === PlanTier.AM3; // TODO(isabella): Test if this behavior works as expected on older tiers

    const planOptions = getPlanOptions({billingConfig, activePlan});
    return (
      <PanelBody data-test-id="body-choose-your-plan">
        {planOptions.map(plan => {
          const isSelected = plan.id === formData.plan;

          // calculate the price with discount
          const cents =
            showSubscriptionDiscount({activePlan, discountInfo}) && discountInfo
              ? getDiscountedPrice({
                  basePrice: plan.basePrice,
                  amount: discountInfo.amount,
                  discountType: discountInfo.discountType,
                  creditCategory: discountInfo.creditCategory,
                })
              : plan.basePrice;
          const basePrice = formatPrice({cents});

          let planContent = getContentForPlan(plan);
          const highlightedFeatures = getHighlightedFeatures(referrer);
          const isFeaturesCheckmarked = !subscription.isFree && isTeamPlanFamily(plan);

          // Additional members is available on any paid plan
          // but it's so impactful it doesn't hurt to add it in for the business plan
          // if the user is coming from a deactivated member header CTA
          if (isBizPlanFamily(plan) && referrer === 'deactivated_member_header') {
            highlightedFeatures.push('deactivated_member_header');
            planContent = cloneDeep(planContent);
            planContent.features.deactivated_member_header = t('Unlimited members');
          }

          return (
            <PlanSelectRow
              key={plan.id}
              isFeaturesCheckmarked={isFeaturesCheckmarked}
              discountInfo={
                showSubscriptionDiscount({activePlan, discountInfo})
                  ? discountInfo
                  : undefined
              }
              shouldShowEventPrice
              plan={plan}
              isSelected={isSelected}
              badge={getBadge(plan)}
              onUpdate={onUpdate}
              planValue={plan.name}
              planName={plan.name}
              priceHeader={t('Starts At')}
              price={basePrice}
              planContent={planContent}
              highlightedFeatures={highlightedFeatures}
              shouldShowDefaultPayAsYouGo={shouldShowDefaultPayAsYouGo}
            />
          );
        })}
      </PanelBody>
    );
  };

  const renderFooter = () => {
    const bizPlan = getPlanOptions({
      billingConfig,
      activePlan,
    }).find(plan => isBizPlanFamily(plan));
    const bizPlanContent: PlanContent = bizPlan
      ? getContentForPlan(bizPlan)
      : {features: {}, description: ''};

    let missingFeatures: string[] = [];

    if (isTeamPlanFamily(activePlan)) {
      const selectedPlanContent = getContentForPlan(activePlan);
      missingFeatures = getHighlightedFeatures(referrer).filter(
        feature => !selectedPlanContent.features[feature]
      );
    }

    return (
      <StepFooter data-test-id="footer-choose-your-plan">
        <div>
          {bizPlanContent.features && missingFeatures.length > 0 ? (
            <FooterWarningWrapper>
              <IconWarning />
              {tct('This plan does not include [missingFeatures]', {
                missingFeatures: (
                  <Oxfordize>
                    {missingFeatures.map(feature => (
                      <b key={feature}>{bizPlanContent.features[feature]}</b>
                    ))}
                  </Oxfordize>
                ),
              })}
            </FooterWarningWrapper>
          ) : (
            tct('Need a custom quote? [link:Contact us].', {
              link: (
                <a
                  href="mailto:sales@sentry.io"
                  onClick={() => {
                    trackGetsentryAnalytics('sales.contact_us_clicked', {
                      organization,
                      subscription,
                      source: 'checkout.plan_select',
                    });
                  }}
                />
              ),
            })
          )}
        </div>
        <Button
          priority="primary"
          onClick={async () => {
            onCompleteStep(stepNumber);
            if (
              isBizPlanFamily(subscription.planDetails) &&
              isTeamPlan(formData.plan) &&
              promotionData
            ) {
              await checkForPromptBasedPromotion({
                organization,
                subscription,
                onRefetch: refetch,
                promptFeature: 'business_to_team_promo',
                promotionData,
                onAcceptConditions: () => {
                  onEdit(1);
                  onUpdate({
                    plan: getBusinessPlanOfTier(formData.plan),
                  });
                },
              });
            }
          }}
          style={{marginLeft: 'auto'}}
        >
          {t('Continue')}
        </Button>
      </StepFooter>
    );
  };

  return (
    <Panel>
      <StepHeader
        canSkip
        title={t('Choose Your Plan')}
        trailingItems={trailingItems}
        isActive={isActive}
        stepNumber={stepNumber}
        isCompleted={isCompleted}
        onEdit={onEdit}
        onToggleLegacy={onToggleLegacy}
        checkoutTier={checkoutTier}
        organization={organization}
      />
      {isActive && renderBody()}
      {isActive && (
        <ProductSelect
          activePlan={activePlan}
          formData={formData}
          onUpdate={onUpdate}
          subscription={subscription}
        />
      )}
      {isActive && renderFooter()}
    </Panel>
  );
}

export default PlanSelect;

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const FooterWarningWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
