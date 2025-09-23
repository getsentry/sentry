import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron, IconLightning, IconLock, IconSentry} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useApi from 'sentry/utils/useApi';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import {useStripeInstance} from 'getsentry/hooks/useStripeInstance';
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
  hasPartnerMigrationFeature,
  isBizPlanFamily,
  isDeveloperPlan,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, getSingularCategoryName} from 'getsentry/utils/dataCategory';
import type {State as CheckoutState} from 'getsentry/views/amCheckout/';
import CartDiff from 'getsentry/views/amCheckout/cartDiff';
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
  formDataForPreview: CheckoutFormData;
  onSuccess: ({
    invoice,
    nextQueryParams,
    isSubmitted,
  }: Pick<CheckoutState, 'invoice' | 'nextQueryParams' | 'isSubmitted'>) => void;
  organization: Organization;
  subscription: Subscription;
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

interface ItemsSummaryProps extends BaseSummaryProps {}

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

function ItemFlex({children}: {children: React.ReactNode}) {
  return (
    <StyledFlex justify="between" align="start" gap="3xl">
      {children}
    </StyledFlex>
  );
}

function ItemsSummary({activePlan, formData}: ItemsSummaryProps) {
  // TODO(checkout v3): This will need to be updated for non-budget products
  const additionalProductCategories = useMemo(
    () =>
      Object.values(activePlan.addOnCategories).flatMap(addOn => addOn.dataCategories),
    [activePlan.addOnCategories]
  );
  const shortInterval = utils.getShortInterval(activePlan.billingInterval);

  return (
    <SummarySection>
      <ItemWithIcon data-test-id="summary-item-plan">
        <IconContainer>{getPlanIcon(activePlan)}</IconContainer>
        <Flex direction="column" gap="xs">
          <ItemFlex>
            <Text bold>{tct('[name] Plan', {name: activePlan.name})}</Text>
            <Text>
              {utils.displayPrice({cents: activePlan.totalPrice})}
              {`/${shortInterval}`}
            </Text>
          </ItemFlex>
          {activePlan.categories
            .filter(
              category =>
                !additionalProductCategories.includes(category) &&
                // only show PAYG-only categories for plans that can use PAYG for them
                ((formData.reserved[category] ?? 0) > 0 || !isDeveloperPlan(activePlan))
            )
            .map(category => {
              const reserved = formData.reserved[category] ?? 0;
              const isPaygOnly = reserved === 0;
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
                    <Text>{isPaygOnly ? '' : `${formattedReserved} `}</Text>
                    {reserved === 1 && category !== DataCategory.ATTACHMENTS
                      ? getSingularCategoryName({
                          plan: activePlan,
                          category,
                          capitalize: false,
                        })
                      : getPlanCategoryName({
                          plan: activePlan,
                          category,
                          capitalize: isPaygOnly,
                        })}
                  </div>
                  {price > 0 ? (
                    <div>
                      {formattedPrice}/{shortInterval}
                    </div>
                  ) : (
                    isPaygOnly && (
                      <Tag>
                        {tct('Available with [budgetTerm]', {
                          budgetTerm: activePlan.budgetTerm,
                        })}
                      </Tag>
                    )
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
  const isDefaultPaygAmount = useMemo(() => {
    const defaultAmount = isBizPlanFamily(activePlan)
      ? PAYG_BUSINESS_DEFAULT
      : PAYG_TEAM_DEFAULT;
    return formData.onDemandMaxSpend === defaultAmount;
  }, [activePlan, formData.onDemandMaxSpend]);

  return (
    <SummarySection>
      {formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.SHARED &&
        !!formData.onDemandMaxSpend && (
          <Item data-test-id="summary-item-spend-limit">
            <ItemFlex>
              <div>
                {tct('[budgetTerm] spend limit', {
                  budgetTerm: capitalize(activePlan.budgetTerm),
                })}
              </div>
              <Flex direction="column" gap="sm" align="end">
                <Text>
                  $0-
                  {utils.displayPrice({
                    cents: formData.onDemandMaxSpend,
                  })}
                  /mo
                </Text>
                <AnimatePresence>
                  {isDefaultPaygAmount && (
                    <motion.div
                      initial={{opacity: 0, y: -10}}
                      animate={{opacity: 1, y: 0}}
                      exit={{opacity: 0, y: -10}}
                      transition={{
                        type: 'spring',
                        duration: 0.4,
                        bounce: 0.1,
                      }}
                    >
                      <Tag icon={<IconSentry size="xs" />} type="info">
                        <Text size="xs">{t('Default Amount')}</Text>
                      </Tag>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Flex>
            </ItemFlex>
          </Item>
        )}
      {formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
        Object.entries(formData.onDemandBudget?.budgets ?? {})
          .filter(([_, budget]) => budget > 0)
          .map(([category, budget]) => {
            return (
              <Item key={category} data-test-id={`summary-item-spend-limit-${category}`}>
                <ItemFlex>
                  <div>
                    {tct('[categoryName] [budgetTerm] spend limit', {
                      categoryName: getPlanCategoryName({
                        plan: activePlan,
                        category: category as DataCategory,
                      }),
                      budgetTerm: activePlan.budgetTerm,
                    })}
                  </div>
                  <Text>
                    $0-
                    {utils.displayPrice({
                      cents: budget,
                    })}
                    /mo
                  </Text>
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

  const fees = utils.getFees({invoiceItems: previewData?.invoiceItems ?? []});
  const credits = utils.getCredits({invoiceItems: previewData?.invoiceItems ?? []});
  const creditApplied = utils.getCreditApplied({
    creditApplied: previewData?.creditApplied ?? 0,
    invoiceItems: previewData?.invoiceItems ?? [],
  });

  return (
    <SummarySection>
      {!previewDataLoading && isDueToday && (
        <Fragment>
          {fees.map(item => {
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
          {!!creditApplied && (
            <Item data-test-id="summary-item-credit_applied">
              <ItemFlex>
                <div>{t('Credit applied')}</div>
                <Credit>{utils.displayPrice({cents: -creditApplied})}</Credit>
              </ItemFlex>
            </Item>
          )}
          {credits.map(item => {
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
            icon={<IconLightning />}
          >
            {isSubmitting ? t('Checking out...') : t('Migrate Now')}
          </StyledButton>
        )}
        <StyledButton
          aria-label={isMigratingPartner ? t('Schedule changes') : t('Confirm and pay')}
          priority="primary"
          onClick={() => onSubmit()}
          disabled={buttonDisabled || previewDataLoading}
          icon={<IconLock locked />}
        >
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
  formDataForPreview,
  onSuccess,
}: CartProps) {
  const [previewState, setPreviewState] = useState<CartPreviewState>(NULL_PREVIEW_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stripe = useStripeInstance();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryIsOpen, setSummaryIsOpen] = useState(true);
  const [changesIsOpen, setChangesIsOpen] = useState(true);
  const api = useApi();
  const {data: billingDetails} = useBillingDetails();
  const hasCompleteBillingInfo = utils.hasBillingInfo(billingDetails, subscription, true);

  const resetPreviewState = () => setPreviewState(NULL_PREVIEW_STATE);

  const fetchPreview = useCallback(async () => {
    await utils.fetchPreviewData(
      organization,
      api,
      formDataForPreview,
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
  }, [api, formDataForPreview, organization, subscription.contractPeriodEnd]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

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
    previewData: previewState.previewData ?? undefined,
    onSuccess,
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
      <CartDiff
        activePlan={activePlan}
        formData={formData}
        subscription={subscription}
        isOpen={changesIsOpen}
        onToggle={setChangesIsOpen}
        organization={organization}
      />
      <PlanSummary>
        <PlanSummaryHeader isOpen={summaryIsOpen}>
          <Heading as="h2" textWrap="nowrap">
            {t('Plan Summary')}
          </Heading>
          <Flex gap="xs" align="center">
            <OrgSlug>{organization.slug.toUpperCase()}</OrgSlug>
            <Button
              aria-label={summaryIsOpen ? t('Hide plan summary') : t('Show plan summary')}
              onClick={() => setSummaryIsOpen(!summaryIsOpen)}
              borderless
              size="xs"
              icon={<IconChevron direction={summaryIsOpen ? 'up' : 'down'} />}
            />
          </Flex>
        </PlanSummaryHeader>
        {summaryIsOpen && (
          <PlanSummaryContents data-test-id="plan-summary">
            <ItemsSummary activePlan={activePlan} formData={formData} />
            <SubtotalSummary
              activePlan={activePlan}
              formData={formData}
              previewDataLoading={previewState.isLoading}
              renewalDate={previewState.renewalDate}
            />
          </PlanSummaryContents>
        )}
      </PlanSummary>
      <TotalSummary
        activePlan={activePlan}
        billedTotal={previewState.billedTotal}
        buttonDisabled={!hasCompleteBillingInfo}
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
  border-bottom: ${p => (p.theme.isChonk ? '3px' : '1px')} solid ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space.xl};

  > *:first-child {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const SummarySection = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 0 ${p => p.theme.space.xl};

  & > *:not(:last-child) {
    margin-bottom: ${p => p.theme.space.xl};
  }

  &:not(:first-child) {
    padding-top: ${p => p.theme.space['2xl']};
  }
`;

const PlanSummary = styled('div')`
  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const PlanSummaryHeader = styled('div')<{isOpen: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
`;

const PlanSummaryContents = styled('div')`
  > *:last-child {
    margin-top: ${p => p.theme.space.lg};
    padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl};
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const OrgSlug = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.subText};
  flex-shrink: 1;
  text-overflow: ellipsis;
  text-wrap: nowrap;
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

const StyledFlex = styled(Flex)`
  line-height: 100%;

  > * {
    margin-bottom: ${p => p.theme.space.xs};
  }

  &:not(:first-child) {
    color: ${p => p.theme.subText};
  }
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-top: 1px;
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
  font-size: ${p => p.theme.fontSize.md};
`;

const DueTodayAmount = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize['2xl']};
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
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  text-align: center;
`;
