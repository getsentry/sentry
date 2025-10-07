import React, {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {TextProps} from 'sentry/components/core/text/text';
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

import ProductTrialTag from 'getsentry/components/productTrial/productTrialTag';
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

const GRID_PROPS = {
  columns: {xs: '2fr repeat(4, 1fr)', md: '2fr repeat(5, 1fr)'},
  padding: 'lg xl' as const,
  borderTop: 'primary' as const,
  gap: 'md' as const,
  align: 'center' as const,
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
  ariaLabel,
  isOpen,
  onToggle,
  hasToggle,
  onDemandSpendUsed,
  formattedCurrentUsage,
  percentUsed,
  isTopMostProduct,
  potentialProductTrial,
  activeProductTrial,
  recurringReservedSpend,
  isPaygOnly,
}: {
  activeProductTrial: ProductTrial | null;
  hasAccess: boolean;
  hasToggle: boolean;
  isPaygOnly: boolean;
  onDemandSpendUsed: number;
  plan: Plan;
  potentialProductTrial: ProductTrial | null;
  productName: React.ReactNode;
  recurringReservedSpend: number;
  ariaLabel?: string; // fix type so this is always required if hasToggle is true
  formattedCurrentUsage?: string;
  isOpen?: boolean;
  isTopMostProduct?: boolean;
  onToggle?: () => void;
  percentUsed?: number;
}) {
  const title = (
    <Flex gap="md" align="center">
      <Container>
        {!hasAccess && <IconLock locked size="xs" />}
        <Text textWrap="pretty" bold={isTopMostProduct}>
          {' '}
          {productName}
        </Text>
      </Container>
      {potentialProductTrial && <ProductTrialTag trial={potentialProductTrial} />}
      {activeProductTrial && <ProductTrialTag trial={activeProductTrial} />}
    </Flex>
  );
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
      {formattedCurrentUsage ? <Text>{formattedCurrentUsage}</Text> : <div />}
      {isPaygOnly ? (
        <Container>
          <Tag>
            {tct('[budgetTerm] only', {
              budgetTerm: displayBudgetName(plan, {title: true}),
            })}
          </Tag>
        </Container>
      ) : defined(percentUsed) ? (
        <Flex gap="sm" align="center">
          <ReservedUsageBar percentUsed={percentUsed} />
          <Text>{percentUsed.toFixed(0) + '%'}</Text>
        </Flex>
      ) : (
        <div />
      )}
      <CurrencyCell>
        {recurringReservedSpend > 0
          ? displayPriceWithCents({cents: recurringReservedSpend})
          : '-'}
      </CurrencyCell>
      <CurrencyCell>
        {onDemandSpendUsed > 0 ? displayPriceWithCents({cents: onDemandSpendUsed}) : '-'}
      </CurrencyCell>
      {potentialProductTrial && (
        <Flex justify="end">
          <Button
            size="xs"
            icon={<IconLightning size="xs" />}
            aria-label={t('Start free 14-day %s trial', productName)}
            priority="primary"
          >
            {t('Start free 14-day trial')}
          </Button>
        </Flex>
      )}
    </Grid>
  );
}

function ReservedUsageBar({percentUsed}: {percentUsed: number}) {
  if (percentUsed === 0 || percentUsed === 100) {
    return <Bar fillPercentage={percentUsed} hasLeftBorderRadius hasRightBorderRadius />;
  }
  const filledWidth = percentUsed * 90;
  const unfilledWidth = 90 - filledWidth;
  return (
    <Flex width="90px">
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
        <CurrencyCell {...tableHeaderProps}>{t('Pay-as-you-go spend')}</CurrencyCell>
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

          const formattedUsage = formatReservedWithUnits(usage, category, {
            useUnitScaling: true,
          });
          const formattedReserved = formatReservedWithUnits(reserved + free, category, {
            useUnitScaling: true,
          });
          const percentUsed = getPercentage(usage, reserved + free);

          const bucket = getBucket({
            events: reserved,
            buckets: subscription.planDetails.planCategories[category],
          });
          const recurringReservedSpend = bucket.price ?? 0;

          return (
            <ProductRow
              key={category}
              plan={subscription.planDetails}
              hasToggle={false}
              onDemandSpendUsed={metricHistory.onDemandSpendUsed}
              productName={productName}
              isPaygOnly={isPaygOnly}
              hasAccess={hasAccess}
              formattedCurrentUsage={
                isPaygOnly ? formattedUsage : `${formattedUsage} / ${formattedReserved}`
              }
              percentUsed={percentUsed}
              isTopMostProduct
              potentialProductTrial={potentialProductTrial}
              activeProductTrial={activeProductTrial}
              recurringReservedSpend={recurringReservedSpend}
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
          const isPaygOnly = reservedBudget ? false : true;

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

          return (
            <Fragment key={apiName}>
              <ProductRow
                plan={subscription.planDetails}
                recurringReservedSpend={recurringReservedSpend}
                ariaLabel={t('Toggle %s usage overview', addOnName)}
                isOpen={!!openState[apiName]}
                onToggle={() =>
                  setOpenState({...openState, [apiName]: !openState[apiName]})
                }
                hasToggle={isEnabled}
                onDemandSpendUsed={paygUsed}
                isPaygOnly={isPaygOnly}
                hasAccess={isEnabled}
                formattedCurrentUsage={
                  reservedBudget
                    ? `${displayPriceWithCents({cents: reservedBudget.totalReservedSpend})} / ${displayPriceWithCents({cents: reservedBudget.reservedBudget + reservedBudget.freeBudget})}`
                    : undefined
                }
                percentUsed={
                  reservedBudget && isEnabled ? reservedBudget.percentUsed : undefined
                }
                productName={addOnName}
                isTopMostProduct
                potentialProductTrial={potentialProductTrial}
                activeProductTrial={activeProductTrial}
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
                          key={category}
                          plan={subscription.planDetails}
                          hasToggle={false}
                          onDemandSpendUsed={categoryDetails.onDemandSpendUsed}
                          productName={productName}
                          isPaygOnly={isPaygOnly}
                          hasAccess={isEnabled}
                          activeProductTrial={null}
                          potentialProductTrial={null}
                          recurringReservedSpend={0}
                          formattedCurrentUsage={displayPriceWithCents({cents: spend})}
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
    p.fillPercentage === 100
      ? p.theme.danger
      : p.fillPercentage > 0
        ? p.theme.active
        : p.theme.gray200};
  border-top-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.borderRadius : 0)};
  border-bottom-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.borderRadius : 0)};
  border-top-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.borderRadius : 0)};
  border-bottom-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.borderRadius : 0)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
