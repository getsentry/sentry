import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconChevron, IconLightning, IconLock, IconSentry} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import {useStripeInstance} from 'getsentry/hooks/useStripeInstance';
import {OnDemandBudgetMode} from 'getsentry/types';
import type {AddOnCategory, Plan, PreviewData, Subscription} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  getCreditApplied,
  getCredits,
  getFees,
  getOnDemandItems,
  getReservedBudgetCategoryForAddOn,
  hasPartnerMigrationFeature,
  isBizPlanFamily,
  isDeveloperPlan,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, getSingularCategoryName} from 'getsentry/utils/dataCategory';
import type {State as CheckoutState} from 'getsentry/views/amCheckout/';
import CartDiff from 'getsentry/views/amCheckout/components/cartDiff';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';
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
  subscription: Subscription;
}

interface TotalSummaryProps extends BaseSummaryProps {
  billedTotal: number;
  buttonDisabled: boolean;
  buttonDisabledText: React.ReactNode;
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

function ItemFlex({
  children,
  'data-test-id': dataTestId,
}: {
  children: React.ReactNode;
  'data-test-id'?: string;
}) {
  return (
    <Flex
      justify="between"
      align="center"
      gap="xl"
      height="18px"
      data-test-id={dataTestId}
    >
      {children}
    </Flex>
  );
}

function ItemWithPrice({
  'data-test-id': dataTestId,
  item,
  price,
  shouldBoldItem,
  isVariableCost,
  isCredit,
}: {
  item: React.ReactNode;
  price: React.ReactNode;
  shouldBoldItem: boolean;
  'data-test-id'?: string;
  isCredit?: boolean;
  isVariableCost?: boolean;
}) {
  return (
    <ItemFlex data-test-id={dataTestId}>
      <Text bold={shouldBoldItem} variant={isVariableCost ? 'muted' : 'primary'}>
        {item}
      </Text>
      <Text
        align="right"
        variant={isVariableCost ? 'muted' : isCredit ? 'success' : 'primary'}
      >
        {price}
      </Text>
    </ItemFlex>
  );
}

function ItemsSummary({activePlan, formData}: ItemsSummaryProps) {
  const theme = useTheme();
  const isXSmallScreen = useMedia(`(max-width: ${theme.breakpoints.xs})`);

  const additionalProductCategories = useMemo(
    () =>
      Object.values(activePlan.addOnCategories).flatMap(addOn => addOn.dataCategories),
    [activePlan.addOnCategories]
  );
  const shortInterval = utils.getShortInterval(activePlan.billingInterval);

  return (
    <Stack gap="2xl" padding="xl" borderTop="primary">
      <Stack gap="md" data-test-id="summary-item-plan">
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
              <Flex
                height="18px"
                width="100%"
                align="center"
                justify="between"
                key={category}
              >
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
                ) : isPaygOnly ? (
                  hasPaygForCategory ? (
                    <Tag>{t('Available')}</Tag>
                  ) : (
                    <Tooltip
                      title={tct('This product is only available with [budgetTerm].', {
                        budgetTerm:
                          (activePlan.budgetTerm === 'pay-as-you-go' ? t('a') : t('an')) +
                          ' ' +
                          displayBudgetName(activePlan, {
                            abbreviated: activePlan.budgetTerm === 'pay-as-you-go',
                            withBudget: true,
                          }),
                      })}
                    >
                      <Tag icon={<IconLock locked size="xs" />}>
                        {isXSmallScreen ? (
                          <Text size="xs">
                            {tct('Unlock with [budgetTerm]', {
                              budgetTerm: displayBudgetName(activePlan, {
                                title: true,
                                abbreviated: activePlan.budgetTerm === 'pay-as-you-go',
                              }),
                            })}
                          </Text>
                        ) : (
                          tct('Unlock with [budgetTerm]', {
                            budgetTerm: displayBudgetName(activePlan, {
                              title: true,
                              abbreviated: activePlan.budgetTerm === 'pay-as-you-go',
                            }),
                          })
                        )}
                      </Tag>
                    </Tooltip>
                  )
                ) : (
                  <Text variant="muted">{t('Included')}</Text>
                )}
              </Flex>
            );
          })}
      </Stack>
      {Object.values(activePlan.addOnCategories)
        .filter(addOnInfo => formData.addOns?.[addOnInfo.apiName]?.enabled)
        .map(addOnInfo => {
          const apiName = addOnInfo.apiName;
          const productName = addOnInfo.productName;

          // if it's a reserved budget add on (e.g. Legacy Seer), get the price; otherwise, we assume it's 0
          // and therefore a variable cost add-on (e.g. Seer)
          const price = utils.getPrepaidPriceForAddOn({
            plan: activePlan,
            addOnCategory: apiName,
          });

          if (price === 0) {
            return null; // we render variable cost add-ons in a different section
          }

          const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);
          const includedBudget = reservedBudgetCategory
            ? (activePlan.availableReservedBudgetTypes[reservedBudgetCategory]
                ?.defaultBudget ?? 0)
            : 0;

          return (
            <Stack
              gap="md"
              key={apiName}
              data-test-id={`summary-item-product-${apiName}`}
            >
              <ItemWithPrice
                item={toTitleCase(productName, {
                  allowInnerUpperCase: true,
                })}
                price={`${utils.displayPrice({
                  cents: price,
                })}/${shortInterval}`}
                shouldBoldItem
              />
              {includedBudget && (
                <div>
                  {tct('Includes [formattedIncludedBudget] monthly credits', {
                    formattedIncludedBudget: utils.displayPrice({
                      cents: includedBudget,
                    }),
                  })}
                </div>
              )}
            </Stack>
          );
        })}
    </Stack>
  );
}

function SubtotalSummary({
  activePlan,
  previewDataLoading,
  formData,
  subscription,
}: SubtotalSummaryProps) {
  const shortInterval = utils.getShortInterval(activePlan.billingInterval);
  const recurringSubtotal = useMemo(() => {
    return utils.getReservedPriceCents({
      plan: activePlan,
      reserved: formData.reserved,
      addOns: formData.addOns,
    });
  }, [activePlan, formData.reserved, formData.addOns]);
  const isDefaultPaygAmount = useMemo(() => {
    const defaultAmount = isBizPlanFamily(activePlan)
      ? PAYG_BUSINESS_DEFAULT
      : PAYG_TEAM_DEFAULT;
    return formData.onDemandMaxSpend === defaultAmount;
  }, [activePlan, formData.onDemandMaxSpend]);
  const shouldShowDefaultPaygTag = useMemo(
    () => isDefaultPaygAmount && isDeveloperPlan(subscription.planDetails),
    [subscription.planDetails, isDefaultPaygAmount]
  );

  return (
    <Stack borderTop="primary" background="primary" width="100%" padding="xl" gap="md">
      <Flex data-test-id="summary-item-plan-total" justify="between" align="center">
        <Text size="lg" bold>
          {t('Plan Total')}
        </Text>
        <Text align="right" size="lg" bold>
          {previewDataLoading ? (
            <Placeholder height="16px" width={PRICE_PLACEHOLDER_WIDTH} />
          ) : (
            `${utils.displayPrice({cents: recurringSubtotal})}/${shortInterval}`
          )}
        </Text>
      </Flex>
      {formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.SHARED &&
        !!formData.onDemandMaxSpend && (
          <Flex justify="between" align="start" data-test-id="summary-item-spend-limit">
            <Text variant="muted">
              {tct('[budgetTerm] spend limit', {
                budgetTerm: displayBudgetName(activePlan, {title: true}),
              })}
            </Text>
            <Flex direction="column" gap="sm" align="end">
              <Text align="right" variant="muted">
                {tct('up to [pricePerMonth]', {
                  pricePerMonth: `${utils.displayPrice({
                    cents: formData.onDemandMaxSpend,
                  })}/mo`,
                })}
              </Text>
              <AnimatePresence>
                {shouldShowDefaultPaygTag && (
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
                    <Tag icon={<IconSentry size="xs" />} variant="info">
                      <Text size="xs">{t('Default Amount')}</Text>
                    </Tag>
                  </motion.div>
                )}
              </AnimatePresence>
            </Flex>
          </Flex>
        )}
      {formData.onDemandBudget?.budgetMode === OnDemandBudgetMode.PER_CATEGORY && (
        <Fragment>
          <Text bold>
            {tct('Per-product [budgetTerm] spend limits', {
              budgetTerm: displayBudgetName(activePlan),
            })}
          </Text>
          {Object.entries(formData.onDemandBudget?.budgets ?? {})
            .filter(([_, budget]) => budget > 0)
            .map(([category, budget]) => {
              return (
                <ItemWithPrice
                  data-test-id={`summary-item-spend-limit-${category}`}
                  key={category}
                  item={getPlanCategoryName({
                    plan: activePlan,
                    category: category as DataCategory,
                  })}
                  price={tct('up to [pricePerMonth]', {
                    pricePerMonth: `${utils.displayPrice({
                      cents: budget,
                    })}/mo`,
                  })}
                  isVariableCost
                  shouldBoldItem={false}
                />
              );
            })}
        </Fragment>
      )}
      <Fragment>
        {formData.addOns &&
          Object.entries(formData.addOns)
            .filter(
              ([apiName, addOn]) =>
                addOn.enabled &&
                !getReservedBudgetCategoryForAddOn(apiName as AddOnCategory) // if not a reserved budget add-on, assume it's a variable cost add-on
            )
            .map(([apiName]) => {
              const addOnInfo = activePlan.addOnCategories[apiName as AddOnCategory];
              if (!addOnInfo) {
                return null;
              }
              return (
                <ItemWithPrice
                  data-test-id={`summary-item-product-${apiName}`}
                  key={apiName}
                  item={toTitleCase(addOnInfo.productName, {allowInnerUpperCase: true})}
                  price={
                    <Fragment>
                      {t('Variable cost')}{' '}
                      <QuestionTooltip
                        size="xs"
                        position="bottom"
                        title={t(
                          // TODO(seer): serialize pricing info
                          '$40 per active contributor. Total varies month to month based on your active contributor count.'
                        )}
                      />
                    </Fragment>
                  }
                  isVariableCost
                  shouldBoldItem={false}
                />
              );
            })}
      </Fragment>
    </Stack>
  );
}

function TotalSummary({
  previewData,
  previewDataLoading,
  originalBilledTotal,
  billedTotal,
  onSubmit,
  buttonDisabled,
  buttonDisabledText,
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
    if (renewalDate) {
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
    } else {
      subtext = tct('Plan renews [longInterval].', {
        longInterval,
      });
    }
    return subtext;
  };

  const fees = getFees({invoiceItems: previewData?.invoiceItems ?? []});
  const onDemandItems = getOnDemandItems({invoiceItems: previewData?.invoiceItems ?? []});
  const credits = getCredits({invoiceItems: previewData?.invoiceItems ?? []});
  const creditApplied = getCreditApplied({
    creditApplied: previewData?.creditApplied ?? 0,
    invoiceItems: previewData?.invoiceItems ?? [],
  });

  const buttonText = isMigratingPartner
    ? t('Schedule changes')
    : isDueToday && billedTotal > 0
      ? t('Confirm and pay')
      : t('Confirm');

  return (
    <Stack border="primary" radius="lg" background="secondary" overflow="hidden">
      <Stack padding="xl xl 0" gap="md">
        <Fragment>
          {!previewDataLoading && (
            <Fragment>
              {fees.map(item => {
                const formattedPrice = utils.displayPrice({cents: item.amount});
                return (
                  <Flex
                    data-test-id={`summary-item-${item.type}`}
                    key={item.type}
                    justify="between"
                    align="center"
                    gap="xs"
                  >
                    <Text size="md" textWrap="pretty">
                      {item.description}
                    </Text>
                    <Text align="right" variant="success">
                      {formattedPrice}
                    </Text>
                  </Flex>
                );
              })}
              {onDemandItems.length > 0 && (
                <Flex
                  data-test-id="summary-item-ondemand-total"
                  justify="between"
                  align="center"
                  gap="xs"
                >
                  <Text size="md" textWrap="pretty">
                    {tct('[budgetTerm] usage', {
                      budgetTerm: displayBudgetName(activePlan, {title: true}),
                    })}
                  </Text>
                  <Text align="right" variant="success">
                    {utils.displayPrice({
                      cents: onDemandItems.reduce((sum, item) => sum + item.amount, 0),
                    })}
                  </Text>
                </Flex>
              )}
              {!!creditApplied && (
                <Flex
                  data-test-id="summary-item-credit_applied"
                  justify="between"
                  align="center"
                  gap="xs"
                >
                  <Text size="md" textWrap="pretty">
                    {t('Credit applied')}
                  </Text>
                  <Text align="right" variant="success">
                    {utils.displayPrice({cents: -creditApplied})}
                  </Text>
                </Flex>
              )}
              {credits.map(item => {
                const formattedPrice = utils.displayPrice({cents: item.amount});
                return (
                  <Flex
                    data-test-id={`summary-item-${item.type}`}
                    key={item.type}
                    justify="between"
                    align="center"
                    gap="xs"
                  >
                    <Text size="md" textWrap="pretty">
                      {item.description}
                    </Text>
                    <Text align="right" variant="success">
                      {formattedPrice}
                    </Text>
                  </Flex>
                );
              })}
            </Fragment>
          )}
        </Fragment>
        <Flex justify="between" align="center" data-test-id="summary-item-due-today">
          <Text bold size="lg">
            {isDueToday
              ? t('Due today')
              : tct('Due on [date]', {
                  date: moment(effectiveDate).format('MMM D, YYYY'),
                })}
          </Text>
          {previewDataLoading ? (
            <Placeholder height="16px" width={PRICE_PLACEHOLDER_WIDTH} />
          ) : (
            <Flex align="end" gap="xs">
              {isDueToday ? (
                <Fragment>
                  {originalBilledTotal > billedTotal && (
                    <Text strikethrough variant="muted" size="xl">
                      {utils.displayPrice({
                        cents: originalBilledTotal,
                      })}{' '}
                    </Text>
                  )}
                  <Text size="xl" bold>
                    {utils.displayPrice({
                      cents: billedTotal,
                    })}
                  </Text>
                </Fragment>
              ) : (
                <Text size="xl" bold>
                  {utils.displayPrice({
                    cents: billedTotal,
                  })}
                </Text>
              )}
              <Flex align="end" paddingBottom="2xs">
                <Text size="md" bold variant="muted">
                  USD
                </Text>
              </Flex>
            </Flex>
          )}
        </Flex>
      </Stack>
      <Stack padding="xl" gap="md">
        <Flex gap="sm" justify="between" align="center">
          {isMigratingPartner && (
            <StyledButton
              aria-label={t('Migrate Now')}
              priority="danger"
              onClick={() => onSubmit(true)}
              disabled={buttonDisabled || previewDataLoading}
              title={buttonDisabled ? buttonDisabledText : undefined}
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
            title={buttonDisabled ? buttonDisabledText : undefined}
            icon={<IconLock locked />}
          >
            {isSubmitting ? t('Checking out...') : buttonText}
          </StyledButton>
        </Flex>
        {previewDataLoading ? (
          <Placeholder height="40px" />
        ) : (
          <Text size="sm" variant="muted" align="center">
            {getSubtext()}
          </Text>
        )}
      </Stack>
    </Stack>
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
  const shouldDisableCheckout = useMemo(
    () => !hasCompleteBillingInfo || subscription.isSuspended,
    [hasCompleteBillingInfo, subscription.isSuspended]
  );

  const resetPreviewState = () => setPreviewState(NULL_PREVIEW_STATE);

  const fetchPreview = useCallback(
    async () => {
      if (shouldDisableCheckout) {
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
            const planItem = invoiceItems.find(item => item.type === 'subscription');
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
    },
    // NOTE: We add `billingDetails` to the dependencies since it affects tax calculations
    // on the preview endpoint
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      api,
      formDataForPreview,
      organization,
      subscription.contractPeriodEnd,
      shouldDisableCheckout,
      billingDetails,
    ]
  );

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
    <Stack data-test-id="cart" direction="column" gap="xl">
      <CartDiff
        activePlan={activePlan}
        formData={formData}
        subscription={subscription}
        isOpen={changesIsOpen}
        onToggle={setChangesIsOpen}
        organization={organization}
      />
      <Stack border="primary" radius="lg" background="primary" overflow="hidden">
        <Stack align="start" width="100%" height="100%">
          <Stack
            direction="row"
            justify="between"
            align="center"
            width="100%"
            padding="lg xl"
          >
            <Heading as="h3" textWrap="nowrap">
              {t('Plan Summary')}
            </Heading>
            <Button
              aria-label={summaryIsOpen ? t('Hide plan summary') : t('Show plan summary')}
              onClick={() => setSummaryIsOpen(!summaryIsOpen)}
              borderless
              size="zero"
              icon={<IconChevron direction={summaryIsOpen ? 'up' : 'down'} />}
            />
          </Stack>
          {summaryIsOpen && (
            <Flex direction="column" gap="lg" data-test-id="plan-summary" width="100%">
              {errorMessage && (
                <Container>
                  <Alert type="error">{errorMessage}</Alert>
                </Container>
              )}
              <ItemsSummary activePlan={activePlan} formData={formData} />
            </Flex>
          )}
          <SubtotalSummary
            activePlan={activePlan}
            formData={formData}
            previewDataLoading={previewState.isLoading}
            renewalDate={previewState.renewalDate}
            subscription={subscription}
          />
        </Stack>
      </Stack>
      <TotalSummary
        activePlan={activePlan}
        billedTotal={previewState.billedTotal}
        buttonDisabled={shouldDisableCheckout}
        buttonDisabledText={
          subscription.isSuspended
            ? tct(
                'Your account has been suspended. Please contact [mailto:support@sentry.io] if you have any questions or need assistance.',
                {
                  mailto: <a href="mailto:support@sentry.io" />,
                }
              )
            : t(
                'Please provide your billing information, including your business address and payment method.'
              )
        }
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
    </Stack>
  );
}

export default Cart;

const StyledButton = styled(Button)`
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
`;
