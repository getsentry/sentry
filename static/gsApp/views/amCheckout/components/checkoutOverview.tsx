import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {
  AddOnCategory,
  BillingConfig,
  Plan,
  Promotion,
  Subscription,
} from 'getsentry/types';
import {OnDemandBudgetMode} from 'getsentry/types';
import {displayBudgetName, formatReservedWithUnits} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {
  showChurnDiscount,
  showSubscriptionDiscount,
} from 'getsentry/utils/promotionUtils';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';
import {
  getTotalBudget,
  hasOnDemandBudgetsFeature,
} from 'getsentry/views/onDemandBudgets/utils';

type Props = {
  activePlan: Plan;
  billingConfig: BillingConfig;
  formData: CheckoutFormData;
  onUpdate: (data: any) => void;
  organization: Organization;
  subscription: Subscription;
  discountInfo?: Promotion['discountInfo'];
};

class CheckoutOverview extends Component<Props> {
  get shortInterval() {
    const {activePlan} = this.props;
    return utils.getShortInterval(activePlan.billingInterval);
  }

  get toggledInterval() {
    const {activePlan} = this.props;
    return activePlan.billingInterval === MONTHLY ? ANNUAL : MONTHLY;
  }

  get nextPlan() {
    const {formData, billingConfig} = this.props;
    const basePlan = formData.plan.replace('_auf', '');
    return billingConfig.planList.find(
      plan =>
        plan.id.indexOf(basePlan) === 0 && plan.billingInterval === this.toggledInterval
    );
  }

  handleChange = () => {
    const {onUpdate} = this.props;
    if (this.nextPlan) {
      onUpdate({
        plan: this.nextPlan.id,
      });
    }
  };

  renderProducts = () => {
    const {formData, activePlan} = this.props;

    return Object.entries(formData.addOns ?? {})
      .filter(([_, addOn]) => addOn.enabled)
      .map(([apiName, _]) => {
        const addOnInfo = activePlan.addOnCategories[apiName as AddOnCategory];

        if (!addOnInfo) {
          return null;
        }
        const price = utils.displayPrice({
          cents: utils.getPrepaidPriceForAddOn({
            plan: activePlan,
            addOnCategory: apiName as AddOnCategory,
          }),
        });
        const productName = addOnInfo.productName;
        return (
          <DetailItem key={apiName} data-test-id={`${apiName}-reserved`}>
            <DetailTitle>
              {toTitleCase(productName, {
                allowInnerUpperCase: true,
              })}
            </DetailTitle>
            <DetailPrice>
              {price}/{this.shortInterval}
            </DetailPrice>
          </DetailItem>
        );
      });
  };

  renderDataOptions = () => {
    const {formData, activePlan} = this.props;

    return activePlan.checkoutCategories.map(category => {
      const eventBucket = utils.getBucket({
        events: formData.reserved[category],
        buckets: activePlan.planCategories[category],
      });
      const price = utils.displayPrice({cents: eventBucket.price});

      return (
        <DetailItem key={category} data-test-id={category}>
          <div>
            <DetailTitle>
              {getPlanCategoryName({
                plan: activePlan,
                category,
              })}
            </DetailTitle>
            {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              formatReservedWithUnits(formData.reserved[category], category)
            }
          </div>
          {eventBucket.price === 0 ? (
            <Tag variant="muted">{t('included')}</Tag>
          ) : (
            <DetailPrice>{`${price}/${this.shortInterval}`}</DetailPrice>
          )}
        </DetailItem>
      );
    });
  };

  renderOnDemand() {
    const {formData, organization, subscription, activePlan} = this.props;
    const {onDemandBudget} = formData;
    let onDemandMaxSpend = formData.onDemandMaxSpend;

    const displayNewOnDemandBudgetsUI = hasOnDemandBudgetsFeature(
      organization,
      subscription
    );

    if (onDemandBudget && displayNewOnDemandBudgetsUI) {
      onDemandMaxSpend = getTotalBudget(onDemandBudget);
    }

    if (!onDemandMaxSpend || onDemandMaxSpend <= 0) {
      return null;
    }

    let prefix = '';

    if (displayNewOnDemandBudgetsUI) {
      if (onDemandBudget) {
        if (onDemandBudget.budgetMode === OnDemandBudgetMode.SHARED) {
          prefix = t('Shared ');
        }
        if (onDemandBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
          prefix = t('Per-Category ');
        }
      }
    }

    const title = `${prefix}${displayBudgetName(activePlan, {title: true})}`;

    const details: React.ReactNode[] = [];

    if (
      !displayNewOnDemandBudgetsUI ||
      (onDemandBudget && onDemandBudget.budgetMode === OnDemandBudgetMode.SHARED)
    ) {
      const onDemandPrice = utils.displayPrice({cents: onDemandMaxSpend});
      details.push(
        <Fragment key="shared-ondemand">
          {tct('up to [onDemandPrice]/mo', {onDemandPrice})}
        </Fragment>
      );
    } else if (onDemandBudget) {
      activePlan.onDemandCategories.forEach(category => {
        if (onDemandBudget.budgets[category]) {
          details.push(
            <Fragment key={`${category}-per-category-ondemand`}>
              {getPlanCategoryName({
                plan: activePlan,
                category,
              })}
              <OnDemandPrice>
                {tct('up to [onDemandPrice]/mo', {
                  onDemandPrice: utils.displayPrice({
                    cents: onDemandBudget.budgets[category],
                  }),
                })}
              </OnDemandPrice>
            </Fragment>
          );
        }
      });
    }

    return (
      <OnDemandDetailItem key="ondemand" data-test-id="ondemand">
        <div>
          <DetailTitle>{title}</DetailTitle>
        </div>
        <Tag variant="muted">{t('enabled')}</Tag>
        <OnDemandDetailItems>{details}</OnDemandDetailItems>
      </OnDemandDetailItem>
    );
  }

  renderDetailItems = () => {
    const {activePlan, discountInfo} = this.props;

    const planName = activePlan.name;

    const showSubscriptionDiscountInfo =
      showSubscriptionDiscount({activePlan, discountInfo}) && discountInfo;
    let price = activePlan.basePrice;
    const originalTotal = utils.displayPrice({cents: activePlan.basePrice});
    if (showSubscriptionDiscountInfo) {
      price = utils.getDiscountedPrice({
        basePrice: price,
        discountType: discountInfo.discountType,
        amount: discountInfo.amount,
        creditCategory: discountInfo.creditCategory,
      });
    }

    const basePrice = utils.displayPrice({cents: price});

    return (
      <Fragment>
        <DetailItem key="plan" data-test-id="plan">
          <div>
            <DetailTitle noBottomMargin={!!discountInfo}>{t('Plan Type')}</DetailTitle>
            {showSubscriptionDiscountInfo ? (
              <ProminantPlanName>{planName}</ProminantPlanName>
            ) : (
              <Fragment>{planName}</Fragment>
            )}
            {showSubscriptionDiscountInfo && (
              <DurationText>{`${discountInfo.durationText}*`}</DurationText>
            )}
          </div>
          <PriceContainer>
            {showSubscriptionDiscountInfo && (
              <PromoDetailTitle noBottomMargin>{t('Promo Price')}</PromoDetailTitle>
            )}
            <DetailPrice>{`${basePrice}/${this.shortInterval}`}</DetailPrice>
            {showSubscriptionDiscountInfo && (
              <DiscountWrapper>
                <OriginalPrice>{`${originalTotal}/${this.shortInterval}`}</OriginalPrice>
                {tct('([percentOff]% off)', {
                  percentOff: discountInfo.amount / 100,
                })}
              </DiscountWrapper>
            )}
          </PriceContainer>
        </DetailItem>
        {this.renderProducts()}
        {this.renderDataOptions()}
        {this.renderOnDemand()}
      </Fragment>
    );
  };

  render() {
    const {formData, activePlan, discountInfo} = this.props;

    let discountData = {};

    const showDiscount =
      (showSubscriptionDiscount({activePlan, discountInfo}) ||
        showChurnDiscount({activePlan, discountInfo})) &&
      discountInfo;

    if (showDiscount) {
      discountData = {
        discountType: discountInfo.discountType,
        amount: discountInfo.amount,
        maxDiscount: discountInfo.maxCentsPerPeriod,
        creditCategory: discountInfo.creditCategory,
      };
    }

    const reservedTotal = utils.getReservedTotal({
      ...formData,
      plan: activePlan,
      ...discountData,
    });

    const originalTotal = utils.getReservedTotal({
      ...formData,
      plan: activePlan,
    });

    const billingInterval =
      discountInfo?.billingInterval === 'monthly' ? 'Months' : 'Years';

    const showChurnDiscountInfo =
      showChurnDiscount({activePlan, discountInfo}) && discountInfo;
    const {onDemandBudget} = formData;

    return (
      <StyledPanel>
        <OverviewHeading>
          {showChurnDiscountInfo && (
            <ChurnPromoText>
              {t(
                'Promotional Price for %s %s*',
                discountInfo.billingPeriods,
                billingInterval
              )}
            </ChurnPromoText>
          )}
          <PlanName>{tct('[name] Plan', {name: activePlan.name})}</PlanName>
          <div>
            <TotalPrice>
              <Currency>$</Currency>
              <div>{reservedTotal}</div>
              <BillingInterval>{`/${this.shortInterval}`}</BillingInterval>
            </TotalPrice>
            {onDemandBudget && getTotalBudget(onDemandBudget) > 0 ? (
              <OnDemandAdditionalCost data-test-id="on-demand-additional-cost">
                {tct('+ [budgetTerm] charges up to [amount][break] based on usage', {
                  budgetTerm: displayBudgetName(activePlan, {title: true}),
                  amount: `${formatCurrency(getTotalBudget(onDemandBudget))}/mo`,
                  break: <br />,
                })}
              </OnDemandAdditionalCost>
            ) : (
              // Placeholder to avoid jumping when PAYG charges are added
              <div style={{height: 33}} />
            )}
          </div>
          {showChurnDiscountInfo && (
            <ChurnPromoText>
              {tct('Current Total Price: [originalTotal] ([amount]% off*)', {
                originalTotal: <DiscountText>${originalTotal}/mo</DiscountText>,
                amount: discountInfo.amount / 100,
              })}
            </ChurnPromoText>
          )}
        </OverviewHeading>
        <DetailItems>{this.renderDetailItems()}</DetailItems>
      </StyledPanel>
    );
  }
}

const StyledPanel = styled(Panel)`
  display: grid;
  grid-template-rows: repeat(2, auto);
  gap: ${space(3)};
  padding: ${space(4)} ${space(3)} ${space(3)};
`;

const OverviewHeading = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  gap: ${space(1.5)};
  font-size: ${p => p.theme.fontSize.xl};
  align-items: center;
  text-align: center;
  justify-items: center;
`;

const PlanName = styled('div')`
  font-weight: 600;
`;

const TotalPrice = styled('div')`
  display: inline-grid;
  grid-template-columns: repeat(3, auto);
  font-size: 56px;
`;

const Currency = styled('div')`
  font-size: 32px;
  padding-top: ${space(1)};
`;

const BillingInterval = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  padding-bottom: ${space(1.5)};
  align-self: end;
`;

const OnDemandAdditionalCost = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const DetailItems = styled(PanelBody)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.lg};
`;

const DetailItem = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(0.5)};
  align-items: center;
  padding: ${space(2)} 0;
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const DetailTitle = styled('div')<{noBottomMargin?: boolean}>`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
  ${p => !p.noBottomMargin && `margin-bottom: ${space(1)};`}
`;

const PromoDetailTitle = styled(DetailTitle)`
  display: flex;
  justify-content: end;
`;

const OnDemandDetailItem = styled(DetailItem)`
  align-items: start;
`;

const OnDemandDetailItems = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};
  column-gap: ${space(1)};
  grid-column: 1 / -1;
`;

const OnDemandPrice = styled('div')`
  text-align: right;
`;

const OriginalPrice = styled('div')`
  color: ${p => p.theme.subText};
  text-decoration: line-through;
`;

const DetailPrice = styled('div')`
  justify-self: end;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  justify-content: end;
`;

const PriceContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const DiscountWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const DurationText = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;
const ProminantPlanName = styled('span')`
  font-weight: 500;
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.gray500};
`;

const ChurnPromoText = styled('span')`
  font-size: ${p => p.theme.fontSize.lg};
  color: ${p => p.theme.subText};
  font-weight: bold;
`;

const DiscountText = styled(ChurnPromoText)`
  text-decoration: line-through;
`;

export default CheckoutOverview;
