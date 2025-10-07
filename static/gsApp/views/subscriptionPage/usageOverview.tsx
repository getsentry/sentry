import React, {Fragment, useEffect, useState} from 'react';
// import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {TextProps} from 'sentry/components/core/text/text';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {
  IconChevron,
  IconDownload,
  IconGraph,
  IconLightning,
  IconLock,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

// import useMedia from 'sentry/utils/useMedia';

import ProductTrialTag from 'getsentry/components/productTrial/productTrialTag';
import StartTrialButton from 'getsentry/components/startTrialButton';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import {
  AddOnCategory,
  OnDemandBudgetMode,
  type Plan,
  type ProductTrial,
  type Subscription,
} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getPercentage,
  getPotentialProductTrial,
  getReservedBudgetCategoryForAddOn,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, sortCategories} from 'getsentry/utils/dataCategory';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';

interface UsageOverviewProps {
  organization: Organization;
  subscription: Subscription;
}

type ToggleableProductRowProps = {
  ariaLabel: string;
  hasToggle: true;
  isOpen: boolean;
  onToggle: () => void;
};

type NonToggleableProductRowProps = {
  hasToggle: false;
  ariaLabel?: never;
  isOpen?: never;
  onToggle?: never;
};

type DataCategoryProductRowProps = {
  dataCategory: DataCategory;
  addOnCategory?: never;
};

type AddOnCategoryProductRowProps = {
  addOnCategory: AddOnCategory;
  dataCategory?: never;
};

type ProductRowProps = (ToggleableProductRowProps | NonToggleableProductRowProps) &
  (DataCategoryProductRowProps | AddOnCategoryProductRowProps) & {
    /**
     * Whether the customer has access to the product
     */
    hasAccess: boolean;
    organization: Organization;
    /**
     * PAYG usage, in cents
     */
    paygTotal: number;
    plan: Plan;
    /**
     * The display name for the product
     */
    productName: string;
    /**
     * Total reserved, in events for volume-based or cents for budget-based
     */
    total: number;
    /**
     * Gifted total, in events for volume-based or cents for budget-based
     */
    free?: number;
    /**
     * Whether the product is the top-most in its hierarchy
     */
    isTopMostProduct?: boolean;
    /**
     * The active product trial for the product, if available, otherwise the potential product trial, if available
     */
    productTrial?: ProductTrial;
    /**
     * The recurring cost for the reserved volume or budget for the product
     */
    recurringReservedSpend?: number;
    /**
     * Reserved total, in events for volume-based or cents for budget-based
     * This is 0 for pay-as-you-go only products
     */
    reserved?: number;
  };

// the breakpoints at which we condense and expand the usage overview table
// const MAX_BREAKPOINT_TO_CONDENSE = 'md';
// const MIN_BREAKPOINT_TO_EXPAND = 'lg';

const GRID_PROPS = {
  columns: '2fr repeat(5, 1fr)',
  padding: 'lg xl' as const,
  borderTop: 'primary' as const,
  gap: '2xl' as const,
  align: 'center' as const,
  overflowX: 'scroll' as const,
  whiteSpace: 'nowrap' as const,
};

function CurrencyCell({
  children,
  bold,
  variant,
}: {
  children: React.ReactNode;
  bold?: boolean;
  variant?: TextProps<'span'>['variant'];
}) {
  return (
    <Text align="right" as="span" bold={bold} variant={variant}>
      {children}
    </Text>
  );
}

function ProductRow({
  plan,
  hasAccess,
  productName,
  dataCategory,
  ariaLabel,
  isOpen,
  onToggle,
  hasToggle,
  isTopMostProduct,
  productTrial,
  recurringReservedSpend,
  free,
  reserved,
  paygTotal,
  total,
  organization,
}: ProductRowProps) {
  // const theme = useTheme();
  // const isScreenSmall = useMedia(
  //   `(max-width: ${theme.breakpoints[MIN_BREAKPOINT_TO_EXPAND]})`
  // );

  const [trialButtonBusy, setTrialButtonBusy] = useState(false);
  const title = (
    <Flex gap="md" align="center" direction="row">
      <Container>
        {!hasAccess && <IconLock locked size="xs" />}
        <Text textWrap="pretty" bold={isTopMostProduct}>
          {' '}
          {productName}
        </Text>
      </Container>
      {productTrial && <ProductTrialTag trial={productTrial} />}
    </Flex>
  );

  const formattedTotal = dataCategory
    ? formatUsageWithUnits(total, dataCategory, {useUnitScaling: true})
    : displayPriceWithCents({cents: total});
  const reservedTotal = (reserved ?? 0) + (free ?? 0);
  const formattedReserved = reservedTotal
    ? dataCategory
      ? formatReservedWithUnits(reservedTotal, dataCategory, {useUnitScaling: true})
      : displayPriceWithCents({cents: reservedTotal})
    : undefined;
  const formattedFree = free
    ? dataCategory
      ? formatReservedWithUnits(free, dataCategory, {useUnitScaling: true})
      : displayPriceWithCents({cents: free})
    : undefined;
  const formattedCurrentUsage =
    isTopMostProduct && formattedReserved
      ? `${formattedTotal} / ${formattedReserved}`
      : formattedTotal;
  const percentUsed = reservedTotal ? getPercentage(total, reservedTotal) : undefined;
  const formattedRecurringReservedSpend = recurringReservedSpend
    ? displayPriceWithCents({cents: recurringReservedSpend})
    : '-';
  const formattedPaygTotal =
    paygTotal > 0 ? displayPriceWithCents({cents: paygTotal}) : '-';

  const isPaygOnly = reserved === 0;

  return (
    <Grid {...GRID_PROPS} borderTop="primary">
      {hasToggle ? (
        <Container>
          <StyledButton
            borderless
            icon={
              isOpen ? <IconChevron direction="up" /> : <IconChevron direction="down" />
            }
            aria-label={ariaLabel}
            onClick={() => onToggle?.()}
          >
            {title}
          </StyledButton>
        </Container>
      ) : (
        <Container paddingLeft={isTopMostProduct ? undefined : '2xl'}>{title}</Container>
      )}
      <Container>
        <Text as="div" textWrap="balance">
          {formattedCurrentUsage}{' '}
          {!isPaygOnly && (
            <QuestionTooltip
              size="xs"
              position="top"
              title={tct('[formattedReserved] reserved[freeString]', {
                formattedReserved,
                freeString: formattedFree
                  ? tct('[formattedFree] gifted', {formattedFree})
                  : '',
              })}
            />
          )}
        </Text>
      </Container>
      {isPaygOnly ? (
        <Container alignSelf="center" justifySelf="start">
          <Tag>
            {tct('[budgetTerm] only', {
              budgetTerm:
                // isScreenSmall
                //   ? plan.budgetTerm === 'pay-as-you-go'
                //     ? 'PAYG'
                //     : 'OD'
                //   :
                displayBudgetName(plan, {title: true}),
            })}
          </Tag>
        </Container>
      ) : defined(percentUsed) ? (
        <Flex gap="sm" align="center">
          <ReservedUsageBar percentUsed={percentUsed / 100} />
          <Text>{percentUsed.toFixed(0) + '%'}</Text>
        </Flex>
      ) : (
        <div />
      )}
      <CurrencyCell>{formattedRecurringReservedSpend}</CurrencyCell>
      <CurrencyCell>{formattedPaygTotal}</CurrencyCell>
      {productTrial && !productTrial.isStarted && (
        <Flex justify="center">
          <StartTrialButton
            organization={organization}
            source="usage-overview"
            requestData={{
              productTrial: {
                category: productTrial.category,
                reasonCode: productTrial.reasonCode,
              },
            }}
            aria-label={t('Start 14 day free %s trial', productName)}
            priority="primary"
            handleClick={() => {
              setTrialButtonBusy(true);
            }}
            onTrialStarted={() => {
              setTrialButtonBusy(true);
            }}
            onTrialFailed={() => {
              setTrialButtonBusy(false);
            }}
            busy={trialButtonBusy}
            disabled={trialButtonBusy}
            size="xs"
          >
            <Flex align="center" gap="sm">
              <IconLightning size="xs" />
              <Container>
                {/* {isScreenSmall ? t('Start trial') :  */}
                {t('Start 14 day free trial')}
                {/* } */}
              </Container>
            </Flex>
          </StartTrialButton>
        </Flex>
      )}
    </Grid>
  );
}

function ReservedUsageBar({percentUsed}: {percentUsed: number}) {
  if (percentUsed === 0 || percentUsed === 1) {
    return <Bar fillPercentage={percentUsed} hasLeftBorderRadius hasRightBorderRadius />;
  }
  const filledWidth = percentUsed * 90;
  const unfilledWidth = 90 - filledWidth;
  return (
    <Flex>
      <Bar fillPercentage={percentUsed} hasLeftBorderRadius width={`${filledWidth}px`} />
      <Bar fillPercentage={0} hasRightBorderRadius width={`${unfilledWidth}px`} />
    </Flex>
  );
}

function UsageOverviewTable({subscription, organization}: UsageOverviewProps) {
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Object.entries(subscription.addOns ?? {})
      .filter(
        ([_, addOnInfo]) =>
          !addOnInfo.billingFlag || organization.features.includes(addOnInfo.billingFlag)
      )
      .forEach(([apiName, _]) => {
        setOpenState(prev => ({...prev, [apiName]: true}));
      });
  }, [subscription.addOns, organization.features]);

  const allAddOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOn => addOn.dataCategories);

  const tableHeaderProps = {
    variant: 'muted' as const,
    bold: true,
  };

  return (
    <Fragment>
      <Grid background="secondary" {...GRID_PROPS}>
        <Text {...tableHeaderProps}>{t('Product')}</Text>
        <Text {...tableHeaderProps}>{t('Current usage')}</Text>
        <Text {...tableHeaderProps}>{t('Reserved usage')}</Text>
        <CurrencyCell {...tableHeaderProps}>{t('Reserved spend')}</CurrencyCell>
        <CurrencyCell {...tableHeaderProps}>
          {tct('[budgetTerm] spend', {
            budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
          })}
        </CurrencyCell>
      </Grid>
      {sortCategories(subscription.categories)
        .filter(metricHistory => !allAddOnDataCategories.includes(metricHistory.category))
        .map(metricHistory => {
          const category = metricHistory.category;
          const productName = getPlanCategoryName({
            plan: subscription.planDetails,
            category,
            title: true,
          });
          const reserved = metricHistory.reserved ?? 0;
          const free = metricHistory.free;
          const usage = metricHistory.usage;
          const activeProductTrial = getActiveProductTrial(
            subscription.productTrials ?? [],
            category
          );
          const potentialProductTrial = getPotentialProductTrial(
            subscription.productTrials ?? [],
            category
          );

          const isPaygOnly = reserved === 0;
          const hasAccess = activeProductTrial
            ? true
            : isPaygOnly
              ? subscription.onDemandBudgets?.budgetMode ===
                OnDemandBudgetMode.PER_CATEGORY
                ? metricHistory.onDemandBudget > 0
                : subscription.onDemandMaxSpend > 0
              : reserved > 0;

          const bucket = getBucket({
            events: reserved,
            buckets: subscription.planDetails.planCategories[category],
          });
          const recurringReservedSpend = bucket.price ?? 0;

          return (
            <ProductRow
              key={category}
              organization={organization}
              dataCategory={category}
              plan={subscription.planDetails}
              hasToggle={false}
              paygTotal={metricHistory.onDemandSpendUsed}
              productName={productName}
              hasAccess={hasAccess}
              total={usage}
              reserved={reserved}
              free={free}
              isTopMostProduct
              recurringReservedSpend={recurringReservedSpend}
              productTrial={activeProductTrial ?? potentialProductTrial ?? undefined}
            />
          );
        })}
      {Object.entries(subscription.addOns ?? {})
        .filter(
          ([_, addOnInfo]) =>
            !addOnInfo.billingFlag ||
            organization.features.includes(addOnInfo.billingFlag)
        )
        .map(([apiName, addOnInfo]) => {
          const addOnName = toTitleCase(addOnInfo.productName, {
            allowInnerUpperCase: true,
          });

          const paygUsed = addOnInfo.dataCategories.reduce((acc, category) => {
            return acc + (subscription.categories[category]?.onDemandSpendUsed ?? 0);
          }, 0);
          const addOnDataCategories = addOnInfo.dataCategories;
          const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(
            apiName as AddOnCategory
          );
          const reservedBudget = reservedBudgetCategory
            ? subscription.reservedBudgets?.find(
                budget => (budget.apiName as string) === reservedBudgetCategory
              )
            : undefined;

          const activeProductTrial = getActiveProductTrial(
            subscription.productTrials ?? [],
            addOnDataCategories[0] as DataCategory
          );
          const potentialProductTrial = getPotentialProductTrial(
            subscription.productTrials ?? [],
            addOnDataCategories[0] as DataCategory
          );
          const isEnabled = addOnInfo.enabled;

          // TODO(isabella): fix this for add-ons with multiple data categories
          const bucket = isEnabled
            ? getBucket({
                buckets:
                  subscription.planDetails.planCategories[
                    addOnDataCategories[0] as DataCategory
                  ],
                events: RESERVED_BUDGET_QUOTA,
              })
            : undefined;
          const recurringReservedSpend = bucket?.price ?? 0;

          if (!isEnabled) {
            <ProductRow
              organization={organization}
              addOnCategory={apiName as AddOnCategory}
              plan={subscription.planDetails}
              recurringReservedSpend={recurringReservedSpend}
              hasToggle={false}
              reserved={reservedBudget?.reservedBudget}
              free={reservedBudget?.freeBudget}
              total={reservedBudget?.totalReservedSpend ?? 0}
              paygTotal={paygUsed}
              hasAccess={isEnabled}
              productName={addOnName}
              isTopMostProduct
              productTrial={activeProductTrial ?? potentialProductTrial ?? undefined}
            />;
          }

          return (
            <Fragment key={apiName}>
              <ProductRow
                organization={organization}
                addOnCategory={apiName as AddOnCategory}
                plan={subscription.planDetails}
                recurringReservedSpend={recurringReservedSpend}
                ariaLabel={t('Toggle %s usage overview', addOnName)}
                isOpen={!!openState[apiName]}
                onToggle={() =>
                  setOpenState({...openState, [apiName]: !openState[apiName]})
                }
                hasToggle
                reserved={reservedBudget?.reservedBudget}
                free={reservedBudget?.freeBudget}
                total={reservedBudget?.totalReservedSpend ?? 0}
                paygTotal={paygUsed}
                hasAccess={isEnabled}
                productName={addOnName}
                isTopMostProduct
                productTrial={activeProductTrial ?? potentialProductTrial ?? undefined}
              />
              {isEnabled && openState[apiName] && (
                <Fragment>
                  {Object.entries(subscription.categories)
                    .filter(([category]) =>
                      addOnDataCategories.includes(category as DataCategory)
                    )
                    .map(([category, categoryDetails]) => {
                      const productName = getPlanCategoryName({
                        plan: subscription.planDetails,
                        category: category as DataCategory,
                        title: true,
                      });
                      const spend =
                        reservedBudget?.categories[category as DataCategory]
                          ?.reservedSpend ?? 0;

                      return (
                        <ProductRow
                          organization={organization}
                          key={category}
                          addOnCategory={apiName as AddOnCategory}
                          plan={subscription.planDetails}
                          hasToggle={false}
                          total={spend}
                          paygTotal={categoryDetails.onDemandSpendUsed}
                          productName={productName}
                          hasAccess={isEnabled}
                          recurringReservedSpend={0}
                        />
                      );
                    })}
                </Fragment>
              )}
            </Fragment>
          );
        })}
    </Fragment>
  );
}

function UsageOverview({subscription, organization}: UsageOverviewProps) {
  const {currentHistory, isPending, isError} = useCurrentBillingHistory();
  return (
    <Container radius="md" border="primary" background="primary">
      <Flex
        justify="between"
        align={{xs: 'start', sm: 'center'}}
        padding="lg xl"
        gap="xl"
        direction={{xs: 'column', sm: 'row'}}
      >
        <Heading as="h3" size="lg">
          {t('Usage Overview')}
        </Heading>
        <Flex gap="lg">
          <LinkButton
            icon={<IconGraph />}
            aria-label={t('View usage history')}
            priority="link"
            to="/settings/billing/usage/"
          >
            {t('View usage history')}
          </LinkButton>
          <Button
            icon={<IconDownload />}
            aria-label={t('Download as CSV')}
            disabled={isPending || isError}
            onClick={() => {
              if (currentHistory) {
                window.open(currentHistory.links.csv, '_blank');
              }
            }}
          >
            {t('Download as CSV')}
          </Button>
        </Flex>
      </Flex>
      <UsageOverviewTable subscription={subscription} organization={organization} />
    </Container>
  );
}

export default UsageOverview;

const StyledButton = styled(Button)`
  padding: 0;
`;

const Bar = styled('div')<{
  fillPercentage: number;
  hasLeftBorderRadius?: boolean;
  hasRightBorderRadius?: boolean;
  width?: string;
}>`
  display: block;
  width: ${p => (p.width ? p.width : '90px')};
  height: 6px;
  background: ${p =>
    p.fillPercentage === 1
      ? p.theme.danger
      : p.fillPercentage > 0
        ? p.theme.active
        : p.theme.gray200};
  border-top-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.borderRadius : 0)};
  border-bottom-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.borderRadius : 0)};
  border-top-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.borderRadius : 0)};
  border-bottom-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.borderRadius : 0)};
`;
