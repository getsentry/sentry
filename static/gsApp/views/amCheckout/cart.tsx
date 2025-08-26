import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {
  InvoiceItemType,
  OnDemandBudgetMode,
  type Plan,
  type PreviewData,
  type Subscription,
} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getPlanIcon,
  getProductIcon,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, getSingularCategoryName} from 'getsentry/utils/dataCategory';
import {loadStripe} from 'getsentry/utils/stripe';
import type {CheckoutFormData, SelectableProduct} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

const PRICE_PLACEHOLDER_WIDTH = '70px';
const DISCOUNT_INVOICE_ITEM_TYPES = [
  InvoiceItemType.RECURRING_DISCOUNT,
  InvoiceItemType.DISCOUNT,
  InvoiceItemType.CREDIT_APPLIED,
  InvoiceItemType.SUBSCRIPTION_CREDIT,
];

const ADDITIONAL_FEES_INVOICE_ITEM_TYPES = [
  InvoiceItemType.CANCELLATION_FEE,
  InvoiceItemType.SALES_TAX,
];

type CartProps = {
  activePlan: Plan;
  api: Client;
  formData: CheckoutFormData;
  hasCompleteBillingDetails: boolean;
  organization: Organization;
  subscription: Subscription;
  referrer?: string;
  // discountInfo?: Promotion['discountInfo']; // TODO(ISABELLA): Add this back in
};

function PlanSummary({
  activePlan,
  formData,
}: {
  activePlan: Plan;
  formData: CheckoutFormData;
}) {
  // TODO(checkout v3): This will need to be updated for non-budget products
  const additionalProductCategories = useMemo(
    () =>
      Object.values(activePlan.availableReservedBudgetTypes).reduce((acc, type) => {
        acc.push(...type.dataCategories);
        return acc;
      }, [] as DataCategory[]),
    [activePlan.availableReservedBudgetTypes]
  );
  const shortInterval = utils.getShortInterval(activePlan.billingInterval);

  return (
    <SummarySection>
      <Title>{t('Plan Summary')}</Title>
      <ItemWithIcon data-test-id="summary-item-plan">
        <IconContainer>{getPlanIcon(activePlan)}</IconContainer>
        <Flex direction="column" gap="xs">
          <ItemFlex>
            <strong>{tct('[name] Plan', {name: activePlan.name})}</strong>
            <div>
              {utils.displayPrice({cents: activePlan.totalPrice})}
              {`/${shortInterval}`}
            </div>
          </ItemFlex>
          {activePlan.categories
            .filter(
              category =>
                !additionalProductCategories.includes(category) &&
                (formData.reserved[category] ?? 0) > 0
            )
            .map(category => {
              const reserved = formData.reserved[category] ?? 0;
              const eventBucket =
                activePlan.planCategories[category] &&
                activePlan.planCategories[category].length <= 1
                  ? null
                  : utils.getBucket({
                      events: reserved,
                      buckets: activePlan.planCategories[category],
                    });
              const price = eventBucket ? eventBucket.price : 0;
              const formattedPrice = utils.displayPrice({
                cents: price,
              });
              const formattedReserved = formatReservedWithUnits(reserved, category);

              return (
                <ItemFlex key={category}>
                  <div>
                    {formattedReserved}{' '}
                    {reserved === 1 && category !== DataCategory.ATTACHMENTS
                      ? getSingularCategoryName({
                          plan: activePlan,
                          category,
                          capitalize: false,
                        })
                      : getPlanCategoryName({
                          plan: activePlan,
                          category,
                          capitalize: false,
                        })}
                  </div>
                  {price > 0 && (
                    <div>
                      {formattedPrice}/{shortInterval}
                    </div>
                  )}
                </ItemFlex>
              );
            })}
        </Flex>
      </ItemWithIcon>
      {/* TODO(checkout-v3): This will need to be updated for non-budget products */}
      {Object.values(activePlan.availableReservedBudgetTypes)
        .filter(
          budgetTypeInfo =>
            formData.selectedProducts?.[
              budgetTypeInfo.apiName as string as SelectableProduct
            ]?.enabled
        )
        .map(budgetTypeInfo => {
          const productIcon = getProductIcon(
            budgetTypeInfo.apiName as string as SelectableProduct
          );

          return (
            <ItemWithIcon
              key={budgetTypeInfo.apiName}
              data-test-id={`summary-item-product-${budgetTypeInfo.apiName}`}
            >
              <IconContainer>{productIcon}</IconContainer>
              <Flex direction="column" gap="xs">
                <ItemFlex>
                  <strong>
                    {toTitleCase(budgetTypeInfo.productCheckoutName, {
                      allowInnerUpperCase: true,
                    })}
                  </strong>
                  <div>
                    {utils.displayPrice({
                      cents: utils.getReservedPriceForReservedBudgetCategory({
                        plan: activePlan,
                        reservedBudgetCategory: budgetTypeInfo.apiName,
                      }),
                    })}
                    /{shortInterval}
                  </div>
                </ItemFlex>
                {budgetTypeInfo.defaultBudget && (
                  <div>
                    {tct('Includes [includedBudget] monthly credits', {
                      includedBudget: utils.displayPrice({
                        cents: budgetTypeInfo.defaultBudget,
                      }),
                    })}
                  </div>
                )}
              </Flex>
            </ItemWithIcon>
          );
        })}
    </SummarySection>
  );
}

function SubtotalSummary({
  activePlan,
  previewDataLoading,
  renewalDate,
  formData,
}: {
  activePlan: Plan;
  formData: CheckoutFormData;
  previewDataLoading: boolean;
  renewalDate: moment.Moment | null;
}) {
  const shortInterval = utils.getShortInterval(activePlan.billingInterval);
  const recurringSubtotal = useMemo(() => {
    return utils.getReservedPriceCents({
      plan: activePlan,
      reserved: formData.reserved,
      selectedProducts: formData.selectedProducts,
    });
  }, [activePlan, formData.reserved, formData.selectedProducts]);

  return (
    <SummarySection>
      {formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.SHARED &&
        !!formData.onDemandMaxSpend && (
          <Item>
            <ItemFlex>
              <div>
                {tct('[budgetTerm] spend cap', {
                  budgetTerm: capitalize(activePlan.budgetTerm),
                })}
              </div>
              <div>
                $0-
                {utils.displayPrice({
                  cents: formData.onDemandMaxSpend,
                })}
                /mo
              </div>
            </ItemFlex>
          </Item>
        )}
      {formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
        Object.entries(formData.onDemandBudget?.budgets ?? {})
          .filter(([_, budget]) => budget > 0)
          .map(([category, budget]) => {
            return (
              <Item key={category}>
                <ItemFlex>
                  <div>
                    {tct('[categoryName] [budgetTerm] spend cap', {
                      categoryName: getPlanCategoryName({
                        plan: activePlan,
                        category: category as DataCategory,
                      }),
                      budgetTerm: activePlan.budgetTerm,
                    })}
                  </div>
                  <div>
                    $0-
                    {utils.displayPrice({
                      cents: budget,
                    })}
                    /mo
                  </div>
                </ItemFlex>
              </Item>
            );
          })}
      <Item>
        <ItemFlex>
          <strong>{t('Plan Total')}</strong>
          {previewDataLoading ? (
            <Placeholder height="16px" width={PRICE_PLACEHOLDER_WIDTH} />
          ) : (
            <span>
              {utils.displayPrice({cents: recurringSubtotal})}/{shortInterval}
            </span>
          )}
        </ItemFlex>
        {previewDataLoading ? (
          <Placeholder height="14px" width="200px" />
        ) : (
          <RenewalDate>
            {tct('Renews [date]', {
              date: moment(renewalDate).format('MMM D, YYYY'),
            })}
          </RenewalDate>
        )}
      </Item>
    </SummarySection>
  );
}

function TotalSummary({
  previewData,
  previewDataLoading,
  originalBilledTotal,
  billedTotal,
  onSubmit,
  buttonDisabled,
  isSubmitting,
  renewalDate,
  activePlan,
  formData,
}: {
  activePlan: Plan;
  billedTotal: number;
  buttonDisabled: boolean;
  formData: CheckoutFormData;
  isSubmitting: boolean;
  onSubmit: () => void;
  originalBilledTotal: number;
  previewData: PreviewData | null;
  previewDataLoading: boolean;
  renewalDate: moment.Moment | null;
}) {
  const longInterval =
    activePlan.billingInterval === 'annual' ? 'yearly' : activePlan.billingInterval;

  const totalOnDemandBudget =
    formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.SHARED
      ? formData.onDemandMaxSpend
      : Object.values(formData.onDemandBudget?.budgets ?? {}).reduce(
          (acc, budget) => acc + budget,
          0
        );

  return (
    <SummarySection>
      {previewDataLoading ? (
        <FullWidthPlaceholder height="16px" />
      ) : (
        <Fragment>
          {previewData?.invoiceItems
            .filter(
              item =>
                ADDITIONAL_FEES_INVOICE_ITEM_TYPES.includes(item.type) ||
                (item.type === InvoiceItemType.BALANCE_CHANGE && item.amount > 0) // they might have an outstanding balance
            )
            .map(item => {
              return (
                <Item key={item.type}>
                  <ItemFlex>
                    <div>{item.description}</div>
                    <div>{utils.displayPrice({cents: item.amount})}</div>
                  </ItemFlex>
                </Item>
              );
            })}
        </Fragment>
      )}
      {!previewDataLoading && !!previewData?.creditApplied && (
        <Item>
          <ItemFlex>
            <div>{t('Credit applied')}</div>
            <Credit>{utils.displayPrice({cents: -previewData.creditApplied})}</Credit>
          </ItemFlex>
        </Item>
      )}
      <Item>
        <ItemFlex>
          <DueToday>{t('Due today')}</DueToday>
          {previewDataLoading ? (
            <Placeholder height="24px" width={PRICE_PLACEHOLDER_WIDTH} />
          ) : (
            <DueTodayPrice>
              {originalBilledTotal > billedTotal && (
                <DueTodayAmountBeforeDiscount>
                  {utils.displayPrice({
                    cents: originalBilledTotal,
                  })}{' '}
                </DueTodayAmountBeforeDiscount>
              )}
              <DueTodayAmount>
                {utils.displayPrice({
                  cents: billedTotal,
                })}
              </DueTodayAmount>
              <span> USD</span>
            </DueTodayPrice>
          )}
        </ItemFlex>
      </Item>
      <StyledButton
        aria-label={t('Confirm and pay')}
        priority="primary"
        onClick={onSubmit}
        disabled={buttonDisabled}
      >
        <IconLock locked />
        {isSubmitting ? t('Checking out...') : t('Confirm and pay')}
      </StyledButton>
      <Subtext>
        {longInterval === 'yearly'
          ? tct(
              'Plan renews [longInterval] on [renewalDate]. Any additional usage will continue to be billed monthly.',
              {
                longInterval,
                renewalDate: moment(renewalDate).format('MMM D, YYYY'),
              }
            )
          : tct(
              'Plan renews [longInterval] on [renewalDate], plus any additional usage[onDemandLimit].',
              {
                longInterval,
                renewalDate: moment(renewalDate).format('MMM D, YYYY'),
                onDemandLimit: totalOnDemandBudget
                  ? tct(' (up to [onDemandMaxSpend]/month)', {
                      onDemandMaxSpend: utils.displayPrice({
                        cents: totalOnDemandBudget,
                      }),
                    })
                  : '',
              }
            )}
      </Subtext>
    </SummarySection>
  );
}

function Cart({
  activePlan,
  api,
  formData,
  subscription,
  organization,
  referrer,
  hasCompleteBillingDetails,
}: CartProps) {
  const [previewDataLoading, setPreviewDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [stripe, setStripe] = useState<stripe.Stripe>();
  const [renewalDate, setRenewalDate] = useState<moment.Moment | null>(null);
  const [originalBilledTotal, setOriginalBilledTotal] = useState(0);
  const [billedTotal, setBilledTotal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPreview = useCallback(async () => {
    await utils.fetchPreviewData(
      organization,
      api,
      formData,
      () => setPreviewDataLoading(true),
      (data: PreviewData | null) => {
        setPreviewData(data);
        setPreviewDataLoading(false);
        setErrorMessage(null);

        if (data) {
          // effectiveAt is the day before the changes are effective
          // for immediate changes, effectiveAt is the current day
          const {effectiveAt, invoiceItems, billedAmount} = data;
          const effectiveImmediately = effectiveAt
            ? new Date(effectiveAt).getTime() <= Date.now() + 3600
            : false;
          const planItem = invoiceItems.find(
            item => item.type === InvoiceItemType.SUBSCRIPTION
          );
          setRenewalDate(
            moment(planItem?.period_end ?? subscription.contractPeriodEnd).add(1, 'day')
          );
          if (effectiveImmediately) {
            // include all items after tax
            setOriginalBilledTotal(
              invoiceItems
                .filter(
                  item =>
                    ![
                      ...DISCOUNT_INVOICE_ITEM_TYPES,
                      InvoiceItemType.BALANCE_CHANGE, // can add or subtract from the total
                    ].includes(item.type)
                )
                .reduce((acc, item) => acc + item.amount, 0)
            );
            setBilledTotal(billedAmount);
          } else {
            setOriginalBilledTotal(0);
            setBilledTotal(0);
          }
        } else {
          setRenewalDate(null);
          setOriginalBilledTotal(0);
          setBilledTotal(0);
        }
      },
      (error: Error) => {
        setErrorMessage(error.message);
        setPreviewDataLoading(false);
        setRenewalDate(null);
        setOriginalBilledTotal(0);
        setBilledTotal(0);
      }
    );
  }, [api, formData, organization, subscription.contractPeriodEnd]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  useEffect(() => {
    loadStripe(Stripe => {
      const apiKey = ConfigStore.get('getsentry.stripePublishKey');
      const instance = Stripe(apiKey);
      setStripe(instance);
    });
  }, []);

  const handleCardAction = (intentDetails: utils.IntentDetails) => {
    utils.stripeHandleCardAction(
      intentDetails,
      stripe,
      () => completeCheckout(intentDetails.paymentIntent),
      stripeErrorMessage => {
        setErrorMessage(stripeErrorMessage ?? null);
        setIsSubmitting(false);
      }
    );
  };

  const completeCheckout = async (intentId?: string) => {
    await utils.submitCheckout(
      organization,
      subscription,
      previewData!,
      formData,
      api,
      () => fetchPreview(),
      (intentDetails: any) => handleCardAction(intentDetails),
      ['invoice'],
      (b: boolean) => setIsSubmitting(b),
      intentId,
      referrer
    );
  };

  const handleConfirmAndPay = (applyNow?: boolean) => {
    if (applyNow) {
      formData.applyNow = true;
    }
    setIsSubmitting(true);
    completeCheckout();
  };

  return (
    <CartContainer>
      {errorMessage && <Alert type="error">{errorMessage}</Alert>}
      <PlanSummary activePlan={activePlan} formData={formData} />
      <SubtotalSummary
        activePlan={activePlan}
        formData={formData}
        previewDataLoading={previewDataLoading}
        renewalDate={renewalDate}
      />
      <TotalSummary
        activePlan={activePlan}
        billedTotal={billedTotal}
        buttonDisabled={!hasCompleteBillingDetails}
        formData={formData}
        isSubmitting={isSubmitting}
        originalBilledTotal={originalBilledTotal}
        previewData={previewData}
        previewDataLoading={previewDataLoading}
        renewalDate={renewalDate}
        onSubmit={() => handleConfirmAndPay()}
      />
    </CartContainer>
  );
}

export default Cart;

const CartContainer = styled(Panel)`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space['2xl']} 0 0;
  gap: ${p => p.theme.space['2xl']};

  & > *:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const SummarySection = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 0 ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};

  & > *:not(:last-child) {
    margin-bottom: ${p => p.theme.space.xl};
  }
`;

const Title = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0 0 ${p => p.theme.space.xl};
`;

const Item = styled('div')`
  line-height: normal;
  align-items: start;
`;

const ItemWithIcon = styled(Item)`
  display: grid;
  grid-template-columns: min-content auto;
  gap: ${p => p.theme.space.xs};
`;

const ItemFlex = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${p => p.theme.space['3xl']};
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const RenewalDate = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const DueToday = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
`;

const DueTodayPrice = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
`;

const DueTodayAmount = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.xl};
`;

const DueTodayAmountBeforeDiscount = styled(DueTodayAmount)`
  text-decoration: line-through;
  color: ${p => p.theme.subText};
`;

const FullWidthPlaceholder = styled(Placeholder)`
  margin-bottom: ${p => p.theme.space.xl};
  width: 100%;
`;

const Credit = styled('div')`
  color: ${p => p.theme.successText};
`;

const StyledButton = styled(Button)`
  display: flex;
  gap: ${p => p.theme.space.sm};
`;

const Subtext = styled('div')`
  margin-top: ${p => p.theme.space['2xl']};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  text-align: center;
`;
