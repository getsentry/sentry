import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
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
  AddOnCategory,
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
  isOpen: boolean;
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

function ItemWithPrice({
  item,
  price,
  shouldBoldItem,
  isCredit,
}: {
  item: React.ReactNode;
  price: React.ReactNode;
  shouldBoldItem: boolean;
  isCredit?: boolean;
}) {
  return (
    <ItemFlex>
      <Text bold={shouldBoldItem}>{item}</Text>
      <Text align="right" variant={isCredit ? 'success' : 'primary'}>
        {price}
      </Text>
    </ItemFlex>
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
    <Flex direction="column" padding="0 xl" gap="2xl">
      <ItemWithIcon data-test-id="summary-item-plan">
        <IconContainer>{getPlanIcon(activePlan)}</IconContainer>
        <Flex direction="column" gap="xs">
          <ItemWithPrice
            item={tct('[name] Plan', {name: activePlan.name})}
            price={`${utils.displayPrice({cents: activePlan.totalPrice})}/${shortInterval}`}
            shouldBoldItem
          />
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
              const hasPaygForCategory =
                formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.PER_CATEGORY
                  ? (formData.onDemandBudget?.budgets?.[category] ?? 0) > 0
                  : (formData.onDemandBudget?.sharedMaxBudget ?? 0) > 0;

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
                    isPaygOnly &&
                    (hasPaygForCategory ? (
                      <Tag>{t('Available')}</Tag>
                    ) : (
                      <Tooltip
                        title={t('This product is only available with a PAYG budget.')}
                      >
                        <Tag icon={<IconLock locked size="xs" />}>
                          {tct('Unlock with [budgetTerm]', {
                            budgetTerm:
                              activePlan.budgetTerm === 'pay-as-you-go'
                                ? 'PAYG'
                                : activePlan.budgetTerm,
                          })}
                        </Tag>
                      </Tooltip>
                    ))
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
          const productName =
            activePlan.addOnCategories[budgetTypeInfo.apiName as unknown as AddOnCategory]
              ?.productName ?? budgetTypeInfo.productCheckoutName;

          return (
            <ItemWithIcon
              key={budgetTypeInfo.apiName}
              data-test-id={`summary-item-product-${budgetTypeInfo.apiName}`}
            >
              <IconContainer>{productIcon}</IconContainer>
              <Flex direction="column" gap="xs">
                <ItemWithPrice
                  item={toTitleCase(productName, {
                    allowInnerUpperCase: true,
                  })}
                  price={`${utils.displayPrice({
                    cents: utils.getReservedPriceForReservedBudgetCategory({
                      plan: activePlan,
                      reservedBudgetCategory: budgetTypeInfo.apiName,
                    }),
                  })}/${shortInterval}`}
                  shouldBoldItem
                />
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
    </Flex>
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
    <Container borderTop="primary">
      <Flex direction="column" padding="2xl xl" gap="md">
        <Item data-test-id="summary-item-plan-total">
          <ItemWithPrice
            item={t('Plan Total')}
            price={
              previewDataLoading ? (
                <Placeholder height="16px" width={PRICE_PLACEHOLDER_WIDTH} />
              ) : (
                `${utils.displayPrice({cents: recurringSubtotal})}/${shortInterval}`
              )
            }
            shouldBoldItem
          />
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
        {formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.SHARED &&
          !!formData.onDemandMaxSpend && (
            <Item data-test-id="summary-item-spend-limit">
              <ItemFlex>
                <Text>
                  {tct('[budgetTerm] spend limit', {
                    budgetTerm: capitalize(activePlan.budgetTerm),
                  })}
                </Text>
                <Flex direction="column" gap="sm" align="end">
                  <Text align="right">
                    {tct('up to [pricePerMonth]', {
                      pricePerMonth: `${utils.displayPrice({
                        cents: formData.onDemandMaxSpend,
                      })}/mo`,
                    })}
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
                <Item
                  key={category}
                  data-test-id={`summary-item-spend-limit-${category}`}
                >
                  <ItemWithPrice
                    item={tct('[categoryName] [budgetTerm] spend limit', {
                      categoryName: getPlanCategoryName({
                        plan: activePlan,
                        category: category as DataCategory,
                      }),
                      budgetTerm: activePlan.budgetTerm,
                    })}
                    price={tct('up to [pricePerMonth]', {
                      pricePerMonth: `${utils.displayPrice({
                        cents: budget,
                      })}/mo`,
                    })}
                    shouldBoldItem={false}
                  />
                </Item>
              );
            })}
      </Flex>
    </Container>
  );
}

function TotalSummary({
  isOpen,
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
    if (isDeveloperPlan(activePlan) || !totalOnDemandBudget) {
      subtext = tct(
        '[effectiveDateSubtext]Plan renews [longInterval] on [renewalDate].',
        {
          effectiveDateSubtext,
          longInterval,
          renewalDate: moment(renewalDate).format('MMM D, YYYY'),
        }
      );
    } else {
      subtext = tct(
        '[effectiveDateSubtext]Plan renews [longInterval] on [renewalDate], plus any additional PAYG usage billed monthly (up to [onDemandMaxSpend]/mo).',
        {
          effectiveDateSubtext,
          longInterval,
          renewalDate: moment(renewalDate).format('MMM D, YYYY'),
          onDemandMaxSpend: utils.displayPrice({
            cents: totalOnDemandBudget,
          }),
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

  const buttonText = isMigratingPartner
    ? t('Schedule changes')
    : isDueToday
      ? t('Confirm and pay')
      : t('Confirm');

  return (
    <Flex direction="column">
      <Flex direction="column" padding="2xl xl 0" gap="md" borderTop="primary">
        {isOpen && (
          <Fragment>
            {!previewDataLoading && (
              <Fragment>
                {fees.map(item => {
                  const formattedPrice = utils.displayPrice({cents: item.amount});
                  return (
                    <Item key={item.type} data-test-id={`summary-item-${item.type}`}>
                      <ItemWithPrice
                        item={item.description}
                        price={formattedPrice}
                        shouldBoldItem={false}
                      />
                    </Item>
                  );
                })}
                {!!creditApplied && (
                  <Item data-test-id="summary-item-credit_applied">
                    <ItemWithPrice
                      item={t('Credit applied')}
                      price={utils.displayPrice({cents: -creditApplied})}
                      shouldBoldItem={false}
                      isCredit
                    />
                  </Item>
                )}
                {credits.map(item => {
                  const formattedPrice = utils.displayPrice({cents: item.amount});
                  return (
                    <Item key={item.type} data-test-id={`summary-item-${item.type}`}>
                      <ItemWithPrice
                        item={item.description}
                        price={formattedPrice}
                        shouldBoldItem={false}
                        isCredit
                      />
                    </Item>
                  );
                })}
              </Fragment>
            )}
          </Fragment>
        )}
        <Item data-test-id="summary-item-due-today">
          <ItemFlex>
            <Text bold size="lg">
              {isDueToday
                ? t('Due today')
                : tct('Due on [date]', {
                    date: moment(effectiveDate).format('MMM D, YYYY'),
                  })}
            </Text>
            {previewDataLoading ? (
              <Placeholder height="24px" width={PRICE_PLACEHOLDER_WIDTH} />
            ) : (
              <Container>
                {isDueToday ? (
                  <Fragment>
                    {originalBilledTotal > billedTotal && (
                      <Text strikethrough variant="muted" size="2xl" bold>
                        {utils.displayPrice({
                          cents: originalBilledTotal,
                        })}{' '}
                      </Text>
                    )}
                    <Text size="2xl" bold>
                      {utils.displayPrice({
                        cents: billedTotal,
                      })}
                    </Text>
                  </Fragment>
                ) : (
                  <Text size="2xl" bold>
                    {utils.displayPrice({
                      cents: billedTotal,
                    })}
                  </Text>
                )}
                <Text size="md"> USD</Text>
              </Container>
            )}
          </ItemFlex>
        </Item>
      </Flex>
      <Flex direction="column" padding="2xl xl" gap="md">
        <Flex gap="sm" justify="between" align="center">
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
            aria-label={buttonText}
            priority="primary"
            onClick={() => onSubmit()}
            disabled={buttonDisabled || previewDataLoading}
            title={
              buttonDisabled
                ? t(
                    'Please provide your billing information, including your business address and payment method'
                  )
                : null
            }
            icon={<IconLock locked />}
          >
            {isSubmitting ? t('Checking out...') : buttonText}
          </StyledButton>
        </Flex>
        {previewDataLoading ? (
          <Placeholder height="40px" />
        ) : (
          <Subtext>{getSubtext()}</Subtext>
        )}
      </Flex>
    </Flex>
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
  const hasCompleteBillingInfo = useMemo(
    () => utils.hasBillingInfo(billingDetails, subscription, true),
    [billingDetails, subscription]
  );

  const resetPreviewState = () => setPreviewState(NULL_PREVIEW_STATE);

  const fetchPreview = useCallback(async () => {
    if (!hasCompleteBillingInfo) {
      // NOTE: this should never be necessary because you cannot clear
      // existing billing info, BUT YA NEVER KNOW
      resetPreviewState();
      return;
    }
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

          setPreviewState(prev => ({
            ...prev,
            originalBilledTotal: proratedAmount,
            billedTotal: billedAmount,
            effectiveDate: atPeriodEnd
              ? moment(effectiveAt).add(1, 'day').toDate()
              : null,
            renewalDate,
          }));
        } else {
          resetPreviewState();
        }
      },
      (error: Error) => {
        setErrorMessage(error.message);
        resetPreviewState();
      }
    );
  }, [
    api,
    formDataForPreview,
    organization,
    subscription.contractPeriodEnd,
    hasCompleteBillingInfo,
  ]);

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
    <Flex data-test-id="cart" direction="column" gap="xl" marginBottom="xl">
      <CartDiff
        activePlan={activePlan}
        formData={formData}
        subscription={subscription}
        isOpen={changesIsOpen}
        onToggle={setChangesIsOpen}
        organization={organization}
      />
      <Flex direction="column" gap="sm" background="primary" radius="md" border="primary">
        <Flex justify="between" align="center" gap="sm" padding="lg xl">
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
        </Flex>
        {summaryIsOpen && (
          <Flex direction="column" gap="lg" data-test-id="plan-summary">
            {errorMessage && <Alert type="error">{errorMessage}</Alert>}
            <ItemsSummary activePlan={activePlan} formData={formData} />
            <SubtotalSummary
              activePlan={activePlan}
              formData={formData}
              previewDataLoading={previewState.isLoading}
              renewalDate={previewState.renewalDate}
            />
          </Flex>
        )}
        <TotalSummary
          isOpen={summaryIsOpen}
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
      </Flex>
    </Flex>
  );
}

export default Cart;

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

const StyledButton = styled(Button)`
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
`;

const Subtext = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  text-align: center;
`;
