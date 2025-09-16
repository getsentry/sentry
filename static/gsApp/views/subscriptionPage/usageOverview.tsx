import React, {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import upperFirst from 'lodash/upperFirst';
import moment from 'moment-timezone';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {TextProps} from 'sentry/components/core/text/text';
import {IconChevron, IconLightning, IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {OnDemandBudgetMode, type Plan, type Subscription} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getActiveProductTrial,
  getPercentage,
  getPotentialProductTrial,
} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

interface UsageOverviewProps {
  subscription: Subscription;
}

enum ProductStatus {
  ACTIVE = 'active',
  TRIAL_AVAILABLE = 'trial_available',
  NEEDS_PURCHASE = 'needs_purchase',
  ACTIVE_TRIAL = 'active_trial',
  REQUIRES_PAYG = 'requires_payg',
}

const PRODUCT_STATUS_TAG_TYPE = {
  [ProductStatus.ACTIVE]: 'success',
  [ProductStatus.TRIAL_AVAILABLE]: 'promotion',
  [ProductStatus.NEEDS_PURCHASE]: 'default',
  [ProductStatus.ACTIVE_TRIAL]: 'success',
  [ProductStatus.REQUIRES_PAYG]: 'default',
} satisfies Record<ProductStatus, TagProps['type']>;

const GRID_PROPS = {
  columns: {xs: '2fr repeat(3, 1fr)', md: '2fr repeat(4, 1fr)'},
  padding: 'lg xl' as const,
  borderTop: 'primary' as const,
  gap: 'md' as const,
  align: 'center' as const,
};

function PaygStatusCell({
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
  productName,
  ariaLabel,
  isOpen,
  onToggle,
  hasToggle,
  onDemandSpendUsed,
  status,
  formattedCurrentUsage,
  percentUsed,
  isGroup,
  icon,
}: {
  hasToggle: boolean;
  onDemandSpendUsed: number;
  plan: Plan;
  productName: React.ReactNode;
  ariaLabel?: string;
  formattedCurrentUsage?: string;
  icon?: React.ReactNode;
  isGroup?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  percentUsed?: number;
  status?: ProductStatus;
}) {
  const title = (
    <Fragment>
      {icon}
      <Text textWrap="pretty" bold={isGroup}>
        {' '}
        {productName}
      </Text>
    </Fragment>
  );
  return (
    <Grid {...GRID_PROPS} borderTop={isGroup ? 'primary' : undefined}>
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
        <Container paddingLeft={isGroup ? undefined : '2xl'}>{title}</Container>
      )}
      <StatusCell>
        {status ? (
          <Tag type={PRODUCT_STATUS_TAG_TYPE[status]}>
            {status === ProductStatus.REQUIRES_PAYG
              ? tct('Requires [budgetTerm]', {
                  budgetTerm: plan.budgetTerm,
                })
              : tct('[status]', {status: upperFirst(status).replace('_', ' ')})}
          </Tag>
        ) : (
          <div />
        )}
      </StatusCell>
      {formattedCurrentUsage ? <Text>{formattedCurrentUsage}</Text> : <div />}
      {percentUsed ? (
        <Flex gap="sm" align="center">
          <ReservedUsageBar percentUsed={percentUsed * 100} />
          <Text>{percentUsed.toFixed(0) + '%'}</Text>
        </Flex>
      ) : (
        <div />
      )}
      {status === ProductStatus.TRIAL_AVAILABLE ? (
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
      ) : (
        <PaygStatusCell>
          {onDemandSpendUsed > 0
            ? displayPriceWithCents({cents: onDemandSpendUsed})
            : '-'}
        </PaygStatusCell>
      )}
    </Grid>
  );
}

function ReservedUsageBar({percentUsed}: {percentUsed: number}) {
  if (percentUsed === 0 || percentUsed === 100) {
    return (
      <Bar isFilled={percentUsed === 100} hasLeftBorderRadius hasRightBorderRadius />
    );
  }
  const filledWidth = percentUsed * 90;
  const unfilledWidth = 90 - filledWidth;
  return (
    <Container>
      <Bar isFilled hasLeftBorderRadius width={`${filledWidth}px`} />
      <Bar isFilled={false} hasRightBorderRadius width={`${unfilledWidth}px`} />
    </Container>
  );
}

function UsageOverviewTable({subscription}: UsageOverviewProps) {
  const [openState, setOpenState] = useState<Record<string, boolean>>({
    plan: true,
  });

  useEffect(() => {
    Object.keys(subscription.planDetails.addOnCategories).forEach(addOn => {
      setOpenState(prev => ({...prev, [addOn]: true}));
    });
  }, [subscription.planDetails.addOnCategories]);

  const hasSharedPayg =
    subscription.onDemandBudgets?.budgetMode === OnDemandBudgetMode.SHARED &&
    subscription.onDemandMaxSpend > 0;
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
        <StatusCell>
          <Text {...tableHeaderProps}>{t('Status')}</Text>
        </StatusCell>
        <Text {...tableHeaderProps}>{t('Current usage')}</Text>
        <Text {...tableHeaderProps}>{t('Reserved usage')}</Text>
        <PaygStatusCell {...tableHeaderProps}>{t('Pay-as-you-go spend')}</PaygStatusCell>
      </Grid>
      <ProductRow
        plan={subscription.planDetails}
        ariaLabel={t('Toggle plan usage overview')}
        isOpen={!!openState.plan}
        onToggle={() => setOpenState({...openState, plan: !openState.plan})}
        hasToggle
        onDemandSpendUsed={subscription.onDemandSpendUsed}
        productName={tct('[planName] Plan', {planName: subscription.planDetails.name})}
        isGroup
      />
      {openState.plan && (
        <Fragment>
          {Object.entries(subscription.categories)
            .filter(
              ([category]) => !allAddOnDataCategories.includes(category as DataCategory)
            )
            .map(([category, categoryDetails]) => {
              const productName = getPlanCategoryName({
                plan: subscription.planDetails,
                category: category as DataCategory,
                title: true,
              });
              const reserved = categoryDetails.reserved ?? 0;
              const free = categoryDetails.free;
              const usage = categoryDetails.usage;
              const activeProductTrial = getActiveProductTrial(
                subscription.productTrials ?? [],
                category as DataCategory
              );
              const potentialProductTrial = getPotentialProductTrial(
                subscription.productTrials ?? [],
                category as DataCategory
              );

              const isPaygOnly = reserved === 0;
              const hasAccess =
                reserved > 0 ||
                (isPaygOnly && (hasSharedPayg || categoryDetails.onDemandBudget > 0));
              const status = activeProductTrial
                ? ProductStatus.ACTIVE_TRIAL
                : potentialProductTrial
                  ? ProductStatus.TRIAL_AVAILABLE
                  : hasAccess
                    ? ProductStatus.ACTIVE
                    : ProductStatus.REQUIRES_PAYG;

              const formattedUsage = formatReservedWithUnits(
                usage,
                category as DataCategory,
                {useUnitScaling: true}
              );
              const formattedReserved = formatReservedWithUnits(
                reserved + free,
                category as DataCategory,
                {useUnitScaling: true}
              );
              const percentUsed = getPercentage(usage, reserved + free);

              return (
                <Container key={category} borderTop="primary">
                  <ProductRow
                    plan={subscription.planDetails}
                    hasToggle={false}
                    onDemandSpendUsed={categoryDetails.onDemandSpendUsed}
                    productName={productName}
                    icon={isPaygOnly ? <IconLock locked size="xs" /> : undefined}
                    status={status}
                    formattedCurrentUsage={
                      isPaygOnly
                        ? formattedUsage
                        : `${formattedUsage} / ${formattedReserved}`
                    }
                    percentUsed={percentUsed}
                  />
                </Container>
              );
            })}
        </Fragment>
      )}
      {Object.entries(subscription.planDetails.addOnCategories).map(
        ([addOn, addOnDetails]) => {
          const addOnName = toTitleCase(addOnDetails.productName, {
            allowInnerUpperCase: true,
          });

          const paygUsed = addOnDetails.dataCategories.reduce((acc, category) => {
            return acc + (subscription.categories[category]?.onDemandSpendUsed ?? 0);
          }, 0);
          const addOnDataCategories = addOnDetails.dataCategories;
          const reservedBudget = subscription.reservedBudgets?.find(
            budget => (budget.apiName as string) === (addOnDetails.apiName as string)
          );

          const activeProductTrial = getActiveProductTrial(
            subscription.productTrials ?? [],
            addOnDetails.dataCategories[0] as DataCategory
          );
          const potentialProductTrial = getPotentialProductTrial(
            subscription.productTrials ?? [],
            addOnDetails.dataCategories[0] as DataCategory
          );
          // TODO: fix this to show real status
          const isEnabled = (reservedBudget?.reservedBudget ?? 0) > 0;
          const status = activeProductTrial
            ? ProductStatus.ACTIVE_TRIAL
            : potentialProductTrial
              ? ProductStatus.TRIAL_AVAILABLE
              : isEnabled
                ? ProductStatus.ACTIVE
                : ProductStatus.NEEDS_PURCHASE;

          return (
            <Fragment key={addOn}>
              <ProductRow
                plan={subscription.planDetails}
                ariaLabel={t('Toggle %s usage overview', addOnName)}
                isOpen={!!openState[addOn]}
                onToggle={() => setOpenState({...openState, [addOn]: !openState[addOn]})}
                hasToggle={isEnabled}
                onDemandSpendUsed={paygUsed}
                status={status}
                formattedCurrentUsage={
                  reservedBudget && isEnabled
                    ? `${displayPriceWithCents({cents: reservedBudget.totalReservedSpend})} / ${displayPriceWithCents({cents: reservedBudget.reservedBudget + reservedBudget.freeBudget})}`
                    : undefined
                }
                percentUsed={
                  reservedBudget && isEnabled ? reservedBudget.percentUsed : undefined
                }
                productName={addOnName}
                isGroup
              />
              {isEnabled && openState[addOn] && (
                <Fragment>
                  {Object.entries(subscription.categories)
                    .filter(([category]) =>
                      addOnDataCategories.includes(category as DataCategory)
                    )
                    .map(([category, categoryDetails]) => {
                      const spend =
                        reservedBudget?.categories[category as DataCategory]
                          ?.reservedSpend ?? 0;
                      const formattedPaygUsed =
                        categoryDetails.onDemandSpendUsed > 0
                          ? displayPriceWithCents({
                              cents: categoryDetails.onDemandSpendUsed,
                            })
                          : '-';

                      return (
                        <Container key={category} borderTop="primary">
                          <Grid {...GRID_PROPS} borderTop={undefined}>
                            <Container paddingLeft="2xl">
                              <Text>
                                {getPlanCategoryName({
                                  plan: subscription.planDetails,
                                  category: category as DataCategory,
                                  title: true,
                                })}
                              </Text>
                            </Container>
                            <StatusCell />
                            {reservedBudget && isEnabled ? (
                              <Text>{displayPriceWithCents({cents: spend})}</Text>
                            ) : (
                              <div />
                            )}
                            <div />
                            <PaygStatusCell>{formattedPaygUsed}</PaygStatusCell>
                          </Grid>
                        </Container>
                      );
                    })}
                </Fragment>
              )}
            </Fragment>
          );
        }
      )}
      <Grid {...GRID_PROPS}>
        <div />
        <StatusCell />
        <div />
        <div />
        <PaygStatusCell bold>
          {tct('Total: [spend]', {
            spend: displayPriceWithCents({cents: subscription.onDemandSpendUsed}),
          })}
        </PaygStatusCell>
      </Grid>
    </Fragment>
  );
}

function UsageOverview({subscription}: UsageOverviewProps) {
  const currentPeriodStart = moment(subscription.onDemandPeriodStart);
  const currentPeriodEnd = moment(subscription.onDemandPeriodEnd);
  const newPeriodStart = moment(subscription.onDemandPeriodEnd).add(1, 'days');
  const daysTilReset = newPeriodStart.diff(moment().startOf('day'), 'days');

  return (
    <Container radius="md" border="primary" background="primary">
      <Flex
        justify="between"
        align={{xs: 'start', sm: 'center'}}
        padding="2xl xl"
        gap="xl"
        direction={{xs: 'column', sm: 'row'}}
      >
        <Container>
          <Heading as="h3" size="lg">
            {t('Usage Overview')}
          </Heading>
          <Text variant="muted" size="md">
            {tct(
              '[currentPeriodStart] - [currentPeriodEnd] ・ Reserved volume resets in [daysTilReset] days',
              {
                currentPeriodStart: currentPeriodStart.format('MMM D, YYYY'),
                currentPeriodEnd: currentPeriodEnd.format('MMM D, YYYY'),
                daysTilReset,
              }
            )}
          </Text>
        </Container>
      </Flex>
      <UsageOverviewTable subscription={subscription} />
    </Container>
  );
}

export default UsageOverview;

const StatusCell = styled(Container)`
  display: block;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;

const StyledButton = styled(Button)`
  padding: 0;
`;

const Bar = styled('div')<{
  isFilled: boolean;
  hasLeftBorderRadius?: boolean;
  hasRightBorderRadius?: boolean;
  width?: string;
}>`
  display: block;
  width: ${p => (p.width ? p.width : '90px')};
  height: 6px;
  background: ${p => (p.isFilled ? p.theme.active : p.theme.gray200)};
  border-top-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.borderRadius : 0)};
  border-bottom-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.borderRadius : 0)};
  border-top-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.borderRadius : 0)};
  border-bottom-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.borderRadius : 0)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
