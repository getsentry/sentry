import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconLightning, IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useApi from 'sentry/utils/useApi';

import {
  InvoiceItemType,
  OnDemandBudgetMode,
  type Plan,
  type PreviewData,
  type Promotion,
  type Subscription,
} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getPlanIcon,
  getProductIcon,
  hasPartnerMigrationFeature,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, getSingularCategoryName} from 'getsentry/utils/dataCategory';
import {loadStripe} from 'getsentry/utils/stripe';
import type {CheckoutFormData, SelectableProduct} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

const PRICE_PLACEHOLDER_WIDTH = '70px';
const NULL_PREVIEW_STATE: CartPreviewState = {
  billedTotal: 0,
  effectiveDate: null,
  originalBilledTotal: 0,
  previewData: null,
  isLoading: false,
  renewalDate: null,
};

interface CartProps {
  activePlan: Plan;
  formData: CheckoutFormData;
  hasCompleteBillingDetails: boolean;
  organization: Organization;
  subscription: Subscription;
  /**
   * TODO(isabella): Add this back in (was not ported from checkout v1 to v2)
   */
  discountInfo?: Promotion['discountInfo'];
  referrer?: string;
}

interface CartPreviewState {
  /**
   * What the customer will actually be billed today
   */
  billedTotal: number;
  /**
   * The date that the changes will take effect
   * This is null for immediate changes
   */
  effectiveDate: Date | null;
  /**
   * True when previewData is being fetched
   */
  isLoading: boolean;
  /**
   * What the customer would've originally been billed today
   * before any credits are applied
   */
  originalBilledTotal: number;
  /**
   * Includes variable invoice items (eg. sales tax, applied credits, etc.)
   * and the final billed total
   */
  previewData: PreviewData | null;
  /**
   * The date that the plan will auto-renew
   */
  renewalDate: Date | null;
}

interface BaseSummaryProps {
  activePlan: Plan;
  formData: CheckoutFormData;
}

interface PlanSummaryProps extends BaseSummaryProps {}

interface SubtotalSummaryProps extends BaseSummaryProps {
  previewDataLoading: boolean;
  renewalDate: Date | null;
}

interface TotalSummaryProps extends BaseSummaryProps {
  billedTotal: number;
  buttonDisabled: boolean;
  effectiveDate: Date | null;
  isSubmitting: boolean;
  onSubmit: (applyNow?: boolean) => void;
  organization: Organization;
  originalBilledTotal: number;
  previewData: PreviewData | null;
  previewDataLoading: boolean;
  renewalDate: Date | null;
  subscription: Subscription;
}

function PlanSummary({activePlan, formData}: PlanSummaryProps) {
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
}: SubtotalSummaryProps) {
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
          <Item data-test-id="summary-item-spend-cap">
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
              <Item key={category} data-test-id={`summary-item-spend-cap-${category}`}>
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
      <Item data-test-id="summary-item-plan-total">
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
          renewalDate && (
            <RenewalDate>
              {tct('Renews [date]', {
                date: moment(renewalDate).format('MMM D, YYYY'),
              })}
            </RenewalDate>
          )
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
  effectiveDate,
  renewalDate,
  activePlan,
  formData,
  organization,
  subscription,
}: TotalSummaryProps) {
  const isMigratingPartner = hasPartnerMigrationFeature(organization);
  const isDueToday = effectiveDate === null;
  const longInterval =
    activePlan.billingInterval === 'annual' ? 'yearly' : activePlan.billingInterval;

  const totalOnDemandBudget =
    formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.SHARED
      ? formData.onDemandMaxSpend
      : Object.values(formData.onDemandBudget?.budgets ?? {}).reduce(
          (acc, budget) => acc + budget,
          0
        );

  const getSubtext = () => {
    if (isMigratingPartner) {
      return tct(
        'These changes will take effect at the end of your current [partnerName] sponsored plan on [newPeriodStart]. If you want these changes to apply immediately, select Migrate Now.',
        {
          partnerName: subscription.partner?.partnership.displayName,
          newPeriodStart: moment(subscription.contractPeriodEnd)
            .add(1, 'days')
            .format('ll'),
        }
      );
    }

    if (subscription.isSelfServePartner) {
      return tct(
        'These changes will apply [applyDate], and you will be billed by [partnerName] monthly for any recurring subscription fees and incurred [budgetType] fees.',
        {
          applyDate: effectiveDate
            ? tct('on [effectiveDate]', {
                effectiveDate: moment(effectiveDate).format('MMM D, YYYY'),
              })
            : t('immediately'),
          partnerName: subscription.partner?.partnership.displayName,
          budgetType: subscription.planDetails.budgetTerm,
        }
      );
    }

    let effectiveDateSubtext = null;
    if (effectiveDate) {
      effectiveDateSubtext = tct('Your changes will apply on [effectiveDate]. ', {
        effectiveDate: moment(effectiveDate).format('MMM D, YYYY'),
      });
    }

    let subtext = null;
    if (longInterval === 'yearly') {
      subtext = tct(
        '[effectiveDateSubtext]Plan renews [longInterval] on [renewalDate]. Any additional usage will continue to be billed monthly.',
        {
          effectiveDateSubtext,
          longInterval,
          renewalDate: moment(renewalDate).format('MMM D, YYYY'),
        }
      );
    } else {
      subtext = tct(
        '[effectiveDateSubtext]Plan renews [longInterval] on [renewalDate], plus any additional usage[onDemandLimit].',
        {
          effectiveDateSubtext,
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
      );
    }
    return subtext;
  };

  return (
    <SummarySection>
      {!previewDataLoading && (
        <Fragment>
          {isDueToday &&
            previewData?.invoiceItems
              .filter(item => item.type === InvoiceItemType.SALES_TAX)
              .map(item => {
                const formattedPrice = utils.displayPrice({cents: item.amount});
                return (
                  <Item key={item.type} data-test-id={`summary-item-${item.type}`}>
                    <ItemFlex>
                      <div>{item.description}</div>
                      <div>{formattedPrice}</div>
                    </ItemFlex>
                  </Item>
                );
              })}
        </Fragment>
      )}
      {!previewDataLoading && isDueToday && !!previewData?.creditApplied && (
        <Item data-test-id="summary-item-credit_applied">
          <ItemFlex>
            <div>{t('Credit applied')}</div>
            <Credit>{utils.displayPrice({cents: -previewData.creditApplied})}</Credit>
          </ItemFlex>
        </Item>
      )}
      <Item data-test-id="summary-item-due-today">
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
      <ButtonContainer>
        {isMigratingPartner && (
          <StyledButton
            aria-label={t('Migrate Now')}
            priority="danger"
            onClick={() => onSubmit(true)}
            disabled={buttonDisabled || previewDataLoading}
          >
            <IconLightning />
            {isSubmitting ? t('Checking out...') : t('Migrate Now')}
          </StyledButton>
        )}
        <StyledButton
          aria-label={isMigratingPartner ? t('Schedule changes') : t('Confirm and pay')}
          priority="primary"
          onClick={() => onSubmit()}
          disabled={buttonDisabled || previewDataLoading}
        >
          <IconLock locked />
          {isSubmitting
            ? t('Checking out...')
            : isMigratingPartner
              ? t('Schedule changes')
              : t('Confirm and pay')}
        </StyledButton>
      </ButtonContainer>
      {previewDataLoading ? (
        <Placeholder height="40px" />
      ) : (
        <Subtext>{getSubtext()}</Subtext>
      )}
    </SummarySection>
  );
}

function Cart({
  activePlan,
  formData,
  subscription,
  organization,
  referrer,
  hasCompleteBillingDetails,
}: CartProps) {
  const [previewState, setPreviewState] = useState<CartPreviewState>(NULL_PREVIEW_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripe, setStripe] = useState<stripe.Stripe>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const api = useApi();

  const resetPreviewState = () => setPreviewState(NULL_PREVIEW_STATE);

  const fetchPreview = useCallback(async () => {
    await utils.fetchPreviewData(
      organization,
      api,
      formData,
      () => setPreviewState(prev => ({...prev, isLoading: true})),
      (data: PreviewData | null) => {
        setPreviewState(prev => ({
          ...prev,
          previewData: data,
          isLoading: false,
        }));
        setErrorMessage(null);

        if (data) {
          // effectiveAt is the day before the changes are effective
          // for immediate changes, effectiveAt is the current day
          const {effectiveAt, atPeriodEnd, invoiceItems, billedAmount, proratedAmount} =
            data;
          const planItem = invoiceItems.find(
            item => item.type === InvoiceItemType.SUBSCRIPTION
          );
          const renewalDate = moment(
            planItem?.period_end ?? subscription.contractPeriodEnd
          )
            .add(1, 'day')
            .toDate();

          if (atPeriodEnd) {
            setPreviewState(prev => ({
              ...prev,
              originalBilledTotal: 0,
              billedTotal: 0,
              effectiveDate: moment(effectiveAt).add(1, 'day').toDate(),
              renewalDate,
            }));
          } else {
            setPreviewState(prev => ({
              ...prev,
              originalBilledTotal: proratedAmount,
              billedTotal: billedAmount,
              effectiveDate: null,
              renewalDate,
            }));
          }
        } else {
          resetPreviewState();
        }
      },
      (error: Error) => {
        setErrorMessage(error.message);
        resetPreviewState();
      }
    );
  }, [api, formData, organization, subscription.contractPeriodEnd]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // TODO(checkout v3): This should be refactored with the new Stripe changes
  useEffect(() => {
    loadStripe(Stripe => {
      const apiKey = ConfigStore.get('getsentry.stripePublishKey');
      const instance = Stripe(apiKey);
      setStripe(instance);
    });
  }, []);

  const handleCardAction = ({intentDetails}: {intentDetails: utils.IntentDetails}) => {
    utils.stripeHandleCardAction(
      intentDetails,
      stripe,
      () =>
        completeCheckout({
          data: utils.normalizeAndGetCheckoutAPIData({
            formData,
            previewToken: previewState.previewData?.previewToken,
            referrer,
            paymentIntent: intentDetails.paymentIntent,
          }),
        }),
      stripeErrorMessage => {
        setErrorMessage(stripeErrorMessage ?? null);
        setIsSubmitting(false);
      }
    );
  };

  const {mutateAsync: completeCheckout} = utils.useSubmitCheckout({
    organization,
    subscription,
    onErrorMessage: setErrorMessage,
    onSubmitting: setIsSubmitting,
    onHandleCardAction: handleCardAction,
    onFetchPreviewData: fetchPreview,
    referrer,
  });

  const handleConfirmAndPay = (applyNow?: boolean) => {
    const {previewData} = previewState;
    if (!previewData) {
      // this should never happen since the button is disabled if there is no preview data
      setErrorMessage(
        t(
          "Cannot complete checkout because we couldn't fetch the preview data. Please try again"
        )
      );
      return;
    }
    if (applyNow) {
      formData.applyNow = true;
    }
    setIsSubmitting(true);
    completeCheckout({
      data: utils.normalizeAndGetCheckoutAPIData({
        formData,
        previewToken: previewState.previewData?.previewToken,
        referrer,
      }),
    });
  };

  return (
    <CartContainer data-test-id="cart">
      {errorMessage && <Alert type="error">{errorMessage}</Alert>}
      <PlanSummary activePlan={activePlan} formData={formData} />
      <SubtotalSummary
        activePlan={activePlan}
        formData={formData}
        previewDataLoading={previewState.isLoading}
        renewalDate={previewState.renewalDate}
      />
      <TotalSummary
        activePlan={activePlan}
        billedTotal={previewState.billedTotal}
        buttonDisabled={!hasCompleteBillingDetails}
        formData={formData}
        isSubmitting={isSubmitting}
        originalBilledTotal={previewState.originalBilledTotal}
        previewData={previewState.previewData}
        previewDataLoading={previewState.isLoading}
        renewalDate={previewState.renewalDate}
        effectiveDate={previewState.effectiveDate}
        onSubmit={handleConfirmAndPay}
        organization={organization}
        subscription={subscription}
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

const Credit = styled('div')`
  color: ${p => p.theme.successText};
`;

const StyledButton = styled(Button)`
  display: flex;
  gap: ${p => p.theme.space.sm};
  flex-grow: 1;
`;

const ButtonContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: space-between;
  align-items: center;
`;

const Subtext = styled('div')`
  margin-top: ${p => p.theme.space['2xl']};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  text-align: center;
`;
