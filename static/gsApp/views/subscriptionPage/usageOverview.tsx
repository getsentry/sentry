import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {TextProps} from 'sentry/components/core/text/text';
import {IconChevron, IconDownload, IconGraph, IconLightning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {OnDemandBudgetMode, type Subscription} from 'getsentry/types';
import {
  displayPercentage,
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

const GRID_PROPS = {
  columns: {xs: 'repeat(4, 1fr)', md: 'repeat(5, 1fr)'},
  padding: 'lg xl' as const,
  borderTop: 'primary' as const,
  gap: 'md' as const,
  align: 'center' as const,
};

function PaygStatusCell({children, bold}: {children: React.ReactNode; bold?: boolean}) {
  return (
    <Text align="right" as="span" bold={bold}>
      {children}
    </Text>
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

  return (
    <Fragment>
      {' '}
      <Grid background="secondary" {...GRID_PROPS}>
        <Text bold>{t('Product')}</Text>
        <StatusCell>
          <Text bold>{t('Status')}</Text>
        </StatusCell>
        <Text bold>{t('Current usage')}</Text>
        <Text bold>{t('Reserved usage')}</Text>
        <PaygStatusCell bold>{t('Pay-as-you-go spend')}</PaygStatusCell>
      </Grid>
      <Flex justify="between" borderTop="primary" padding="0 xl" align="center">
        <StyledButton
          borderless
          icon={
            openState.plan ? (
              <IconChevron direction="up" />
            ) : (
              <IconChevron direction="down" />
            )
          }
          aria-label={t('Toggle plan usage overview')}
          onClick={() => setOpenState({...openState, plan: !openState.plan})}
        >
          <Text bold>
            {tct('[planName] Plan', {planName: subscription.planDetails.name})}
          </Text>
        </StyledButton>
        <PaygStatusCell>
          {subscription.onDemandSpendUsed > 0
            ? displayPriceWithCents({cents: subscription.onDemandSpendUsed})
            : '-'}
        </PaygStatusCell>
      </Flex>
      {openState.plan && (
        <Fragment>
          {Object.entries(subscription.categories)
            .filter(
              ([category]) => !allAddOnDataCategories.includes(category as DataCategory)
            )
            .map(([category, categoryDetails]) => {
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

              const status = activeProductTrial
                ? t('Active trial')
                : potentialProductTrial
                  ? t('Trial available')
                  : hasSharedPayg || reserved > 0 || categoryDetails.onDemandBudget > 0
                    ? t('Active')
                    : tct('Requires [budgetTerm]', {
                        budgetTerm: subscription.planDetails.budgetTerm,
                      });
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
              const formattedPercentUsed = displayPercentage(usage, reserved + free);
              const isPaygOnly = reserved === 0;
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
                    <StatusCell>
                      <Tag
                        type={
                          status === 'Active' || status === 'Active trial'
                            ? 'success'
                            : status === 'Trial available'
                              ? 'promotion'
                              : 'default'
                        }
                      >
                        {status}
                      </Tag>
                    </StatusCell>
                    <Text>
                      {isPaygOnly
                        ? formattedUsage
                        : `${formattedUsage} / ${formattedReserved}`}
                    </Text>
                    {isPaygOnly ? (
                      <Container>
                        <Tag>
                          {tct('[budgetTerm] only', {
                            budgetTerm: capitalize(subscription.planDetails.budgetTerm),
                          })}
                        </Tag>
                      </Container>
                    ) : (
                      <Flex gap="sm" align="center">
                        <ReservedUsageBar percentUsed={percentUsed} />
                        <Text>{formattedPercentUsed}</Text>
                      </Flex>
                    )}
                    <PaygStatusCell>{formattedPaygUsed}</PaygStatusCell>
                  </Grid>
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
            ? t('Active trial')
            : potentialProductTrial
              ? t('Trial available')
              : isEnabled
                ? t('Active')
                : t('Needs purchase');

          return (
            <Fragment key={addOn}>
              <Grid {...GRID_PROPS}>
                {isEnabled ? (
                  <Container>
                    <StyledButton
                      borderless
                      icon={
                        openState[addOn] ? (
                          <IconChevron direction="up" />
                        ) : (
                          <IconChevron direction="down" />
                        )
                      }
                      aria-label={t('Toggle %s usage overview', addOnName)}
                      onClick={() =>
                        setOpenState({...openState, [addOn]: !openState[addOn]})
                      }
                    >
                      <Text bold>{addOnName}</Text>
                    </StyledButton>
                  </Container>
                ) : (
                  <Text bold>{addOnName}</Text>
                )}
                <StatusCell>
                  <Tag
                    type={
                      status === 'Active' || status === 'Active trial'
                        ? 'success'
                        : status === 'Trial available'
                          ? 'promotion'
                          : 'default'
                    }
                  >
                    {status}
                  </Tag>
                </StatusCell>
                {reservedBudget && isEnabled ? (
                  <Fragment>
                    <Text>
                      {displayPriceWithCents({cents: reservedBudget.totalReservedSpend})}{' '}
                      /{' '}
                      {displayPriceWithCents({
                        cents: reservedBudget.reservedBudget + reservedBudget.freeBudget,
                      })}
                    </Text>
                    <Flex gap="sm" align="center">
                      <ReservedUsageBar percentUsed={reservedBudget.percentUsed * 100} />
                      <Text>
                        {displayPercentage(
                          reservedBudget.totalReservedSpend,
                          reservedBudget.reservedBudget + reservedBudget.freeBudget
                        )}
                      </Text>
                    </Flex>
                  </Fragment>
                ) : (
                  <Fragment>
                    <div />
                    <div />
                  </Fragment>
                )}
                {isEnabled ? (
                  <PaygStatusCell>
                    {paygUsed > 0 ? displayPriceWithCents({cents: paygUsed}) : '-'}
                  </PaygStatusCell>
                ) : potentialProductTrial ? (
                  // TODO: add link to start trial
                  <Flex justify="end">
                    <Button priority="primary" icon={<IconLightning />} size="xs">
                      {t('Start 14 day free trial')}
                    </Button>
                  </Flex>
                ) : (
                  <div />
                )}
              </Grid>
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
        <Flex gap="md">
          <Button icon={<IconDownload size="sm" />}>
            <Text size="sm">{t('Export CSV')}</Text>
          </Button>
          <Button icon={<IconGraph size="sm" />}>
            <Text size="sm">{t('View usage history')}</Text>
          </Button>
        </Flex>
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
