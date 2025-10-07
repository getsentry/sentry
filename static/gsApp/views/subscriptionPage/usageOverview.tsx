import React, {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {TextProps} from 'sentry/components/core/text/text';
import QuestionTooltip from 'sentry/components/questionTooltip';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable from 'sentry/components/tables/gridEditable';
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

  const columnOrder: GridColumnOrder[] = [
    {key: 'product', name: t('Product'), width: 400},
    {key: 'currentUsage', name: t('Current usage')},
    {key: 'reservedUsage', name: t('Reserved usage')},
    {key: 'reservedSpend', name: t('Reserved spend')},
    {
      key: 'budgetSpend',
      name: t('%s spend', displayBudgetName(subscription.planDetails, {title: true})),
    },
    {
      key: 'cta',
      name: '',
    },
  ];

  const productData: Array<{
    attrs: {
      hasAccess: boolean;
      isPaygOnly: boolean;
      addOnCategory?: AddOnCategory;
      ariaLabel?: string;
      dataCategory?: DataCategory;
      free?: number;
      hasToggle?: boolean;
      isChildProduct?: boolean;
      isOpen?: boolean;
      onToggle?: () => void;
      productTrial?: ProductTrial;
      reserved?: number;
    };
    gridData: {
      budgetSpend: number;
      currentUsage: number;
      product: string;
      reservedSpend?: number;
      reservedUsage?: number;
    };
  }> = useMemo(() => {
    return [
      ...sortCategories(subscription.categories)
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
          const total = metricHistory.usage;
          const paygTotal = metricHistory.onDemandSpendUsed;
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
          const reservedTotal = (reserved ?? 0) + (free ?? 0);
          const percentUsed = reservedTotal
            ? getPercentage(total, reservedTotal)
            : undefined;

          return {
            attrs: {
              dataCategory: category,
              hasAccess,
              isPaygOnly,
              free,
              reserved,
              productTrial: activeProductTrial ?? potentialProductTrial ?? undefined,
            },
            gridData: {
              product: productName,
              currentUsage: total,
              reservedUsage: percentUsed,
              reservedSpend: recurringReservedSpend,
              budgetSpend: paygTotal,
            },
          };
        }),
      ...Object.entries(subscription.addOns ?? {})
        .filter(
          ([_, addOnInfo]) =>
            !addOnInfo.billingFlag ||
            organization.features.includes(addOnInfo.billingFlag)
        )
        .map(([apiName, addOnInfo]) => {
          const addOnName = toTitleCase(addOnInfo.productName, {
            allowInnerUpperCase: true,
          });

          const paygTotal = addOnInfo.dataCategories.reduce((acc, category) => {
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
          const percentUsed = reservedBudget?.totalReservedSpend
            ? getPercentage(paygTotal, reservedBudget?.totalReservedSpend)
            : undefined;
          const activeProductTrial = getActiveProductTrial(
            subscription.productTrials ?? [],
            addOnDataCategories[0] as DataCategory
          );
          const potentialProductTrial = getPotentialProductTrial(
            subscription.productTrials ?? [],
            addOnDataCategories[0] as DataCategory
          );
          const hasAccess = addOnInfo.enabled;

          // TODO(isabella): fix this for add-ons with multiple data categories
          const bucket = hasAccess
            ? getBucket({
                buckets:
                  subscription.planDetails.planCategories[
                    addOnDataCategories[0] as DataCategory
                  ],
                events: RESERVED_BUDGET_QUOTA,
              })
            : undefined;
          const recurringReservedSpend = bucket?.price ?? 0;

          return {
            attrs: {
              addOnCategory: apiName as AddOnCategory,
              hasAccess,
              free: reservedBudget?.freeBudget ?? 0,
              reserved: reservedBudget?.reservedBudget ?? 0,
              isPaygOnly: !reservedBudget,
              productTrial: activeProductTrial ?? potentialProductTrial ?? undefined,
              hasToggle: true,
              isOpen: openState[apiName],
              onToggle: () => {
                setOpenState(prev => ({...prev, [apiName]: !prev[apiName]}));
              },
              ariaLabel: openState[apiName]
                ? t('Collapse %s info', addOnName)
                : t('Expand %s info', addOnName),
            },
            gridData: {
              product: addOnName,
              currentUsage: (reservedBudget?.totalReservedSpend ?? 0) + paygTotal,
              reservedUsage: percentUsed,
              reservedSpend: recurringReservedSpend,
              budgetSpend: paygTotal,
            },
          };
        }),
      ...Object.entries(subscription.addOns ?? {})
        .filter(
          ([apiName, addOnInfo]) =>
            (!addOnInfo.billingFlag ||
              organization.features.includes(addOnInfo.billingFlag)) &&
            addOnInfo.enabled &&
            openState[apiName]
        )
        .flatMap(([apiName, addOnInfo]) => {
          const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(
            apiName as AddOnCategory
          );
          const reservedBudget = reservedBudgetCategory
            ? subscription.reservedBudgets?.find(
                budget => (budget.apiName as string) === reservedBudgetCategory
              )
            : undefined;
          return addOnInfo.dataCategories.map(addOnDataCategory => {
            const reservedBudgetSpend =
              reservedBudget?.categories[addOnDataCategory]?.reservedSpend ?? 0;
            const paygTotal =
              subscription.categories[addOnDataCategory]?.onDemandSpendUsed ?? 0;
            const productName = getPlanCategoryName({
              plan: subscription.planDetails,
              category: addOnDataCategory,
              title: true,
            });
            return {
              attrs: {
                addOnCategory: apiName as AddOnCategory,
                isChildProduct: true,
                isOpen: openState[apiName],
                hasAccess: true,
                isPaygOnly: false,
              },
              gridData: {
                budgetSpend: paygTotal,
                currentUsage: (reservedBudgetSpend ?? 0) + paygTotal,
                product: productName,
              },
            };
          });
        }),
    ];
  }, [subscription, allAddOnDataCategories, organization.features, openState]);

  return (
    <Fragment>
      <Container maxWidth={{xs: '992px', md: '100%'}}>
        <GridEditable
          bodyStyle={{
            borderTopLeftRadius: '0px',
            borderTopRightRadius: '0px',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            marginBottom: '0px',
          }}
          minimumColWidth={200}
          fit="max-content"
          columnOrder={columnOrder}
          data={productData.map(product => product.gridData)}
          columnSortBy={[]}
          grid={{
            renderHeadCell: column => {
              return <Text {...tableHeaderProps}>{column.name}</Text>;
            },
            renderBodyCell: (column, row) => {
              const attrs = productData.find(
                product => product.gridData.product === row.product
              )?.attrs;
              if (!attrs) {
                return row[column.key as keyof typeof row];
              }
              const {
                dataCategory,
                hasAccess,
                isPaygOnly,
                free,
                reserved,
                isOpen,
                isChildProduct,
              } = attrs;

              if (defined(isOpen) && !isOpen && isChildProduct) {
                return null;
              }

              switch (column.key) {
                case 'product': {
                  const {hasToggle, onToggle, ariaLabel, productTrial} = attrs;
                  const title = (
                    <Flex gap="xs">
                      <Container>
                        {!hasAccess && <IconLock locked size="xs" />}
                        <Text textWrap="pretty" bold>
                          {' '}
                          {row.product}
                        </Text>
                      </Container>
                      {productTrial && <ProductTrialTag trial={productTrial} />}
                    </Flex>
                  );

                  if (hasToggle) {
                    return (
                      <Container>
                        <StyledButton
                          borderless
                          icon={
                            isOpen ? (
                              <IconChevron direction="up" />
                            ) : (
                              <IconChevron direction="down" />
                            )
                          }
                          aria-label={ariaLabel}
                          onClick={() => onToggle?.()}
                        >
                          {title}
                        </StyledButton>
                      </Container>
                    );
                  }
                  return (
                    <Container paddingLeft={isChildProduct ? '2xl' : undefined}>
                      {title}
                    </Container>
                  );
                }
                case 'currentUsage': {
                  const formattedTotal = dataCategory
                    ? formatUsageWithUnits(row.currentUsage, dataCategory, {
                        useUnitScaling: true,
                      })
                    : displayPriceWithCents({cents: row.currentUsage});
                  const formattedReserved = dataCategory
                    ? formatReservedWithUnits(reserved ?? 0, dataCategory, {
                        useUnitScaling: true,
                      })
                    : displayPriceWithCents({cents: reserved ?? 0});
                  const formattedFree = dataCategory
                    ? formatReservedWithUnits(free ?? 0, dataCategory, {
                        useUnitScaling: true,
                      })
                    : displayPriceWithCents({cents: free ?? 0});
                  const formattedReservedTotal = dataCategory
                    ? formatReservedWithUnits(
                        (reserved ?? 0) + (free ?? 0),
                        dataCategory,
                        {
                          useUnitScaling: true,
                        }
                      )
                    : displayPriceWithCents({cents: (reserved ?? 0) + (free ?? 0)});
                  const formattedCurrentUsage = isPaygOnly
                    ? formattedTotal
                    : `${formattedTotal} / ${formattedReservedTotal}`;
                  return (
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
                  );
                }
                case 'reservedUsage': {
                  if (isPaygOnly) {
                    return (
                      <Container alignSelf="start" justifySelf="center">
                        <Tag>
                          {tct('[budgetTerm] only', {
                            budgetTerm: displayBudgetName(subscription.planDetails, {
                              title: true,
                            }),
                          })}
                        </Tag>
                      </Container>
                    );
                  }
                  const percentUsed = row.reservedUsage;
                  if (defined(percentUsed)) {
                    return (
                      <Flex gap="sm" align="center">
                        <ReservedUsageBar percentUsed={percentUsed / 100} />
                        <Text>{percentUsed.toFixed(0) + '%'}</Text>
                      </Flex>
                    );
                  }
                  return <div />;
                  break;
                }
                case 'reservedSpend':
                case 'budgetSpend': {
                  const spend = row[column.key as keyof typeof row];
                  const formattedSpend = spend
                    ? displayPriceWithCents({cents: spend as number})
                    : '-';
                  return <CurrencyCell>{formattedSpend}</CurrencyCell>;
                }
                case 'cta': {
                  const productTrial = attrs.productTrial;
                  if (productTrial && !productTrial.isStarted) {
                    return (
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
                          aria-label={t('Start 14 day free %s trial', row.product)}
                          priority="primary"
                          // handleClick={() => {
                          //   setTrialButtonBusy(true);
                          // }}
                          // onTrialStarted={() => {
                          //   setTrialButtonBusy(true);
                          // }}
                          // onTrialFailed={() => {
                          //   setTrialButtonBusy(false);
                          // }}
                          // busy={trialButtonBusy}
                          // disabled={trialButtonBusy}
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
                    );
                  }
                  return <div />;
                  break;
                }
                default:
                  return row[column.key as keyof typeof row];
              }
            },
          }}
        />
      </Container>
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
