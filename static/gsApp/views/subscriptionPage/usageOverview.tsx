import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {TextProps} from 'sentry/components/core/text/text';
import useDrawer from 'sentry/components/globalDrawer';
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
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

import ProductTrialTag from 'getsentry/components/productTrial/productTrialTag';
import StartTrialButton from 'getsentry/components/startTrialButton';
import {RESERVED_BUDGET_QUOTA, UNLIMITED, UNLIMITED_RESERVED} from 'getsentry/constants';
import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import {
  AddOnCategory,
  OnDemandBudgetMode,
  type CustomerUsage,
  type EventBucket,
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
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  sortCategories,
} from 'getsentry/utils/dataCategory';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';
import CategoryUsageDrawer from 'getsentry/views/subscriptionPage/components/categoryUsageDrawer';
import {EMPTY_STAT_TOTAL} from 'getsentry/views/subscriptionPage/usageTotals';

interface UsageOverviewProps {
  organization: Organization;
  subscription: Subscription;
  usageData: CustomerUsage;
}

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

function UsageOverviewTable({subscription, organization, usageData}: UsageOverviewProps) {
  const hasBillingPerms = organization.access.includes('org:billing');
  const navigate = useNavigate();
  const location = useLocation();
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const {isDrawerOpen, openDrawer} = useDrawer();
  const [trialButtonBusyState, setTrialButtonBusyState] = useState<
    Partial<Record<DataCategory, boolean>>
  >({});

  const handleCloseDrawer = useCallback(
    (replace: boolean) => {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            drawer: undefined,
          },
        },
        {replace}
      );
    },
    [navigate, location.query, location.pathname]
  );

  useEffect(() => {
    Object.entries(subscription.addOns ?? {})
      .filter(
        // only show add-on data categories if the add-on is enabled
        ([_, addOnInfo]) =>
          !addOnInfo.billingFlag ||
          (organization.features.includes(addOnInfo.billingFlag) && addOnInfo.enabled)
      )
      .forEach(([apiName, _]) => {
        setOpenState(prev => ({...prev, [apiName]: true}));
      });
  }, [subscription.addOns, organization.features]);

  useEffect(() => {
    if (!isDrawerOpen && location.query.drawer) {
      const dataCategory = location.query.drawer as DataCategory;
      const categoryInfo = subscription.categories[dataCategory];
      const productName = getPlanCategoryName({
        plan: subscription.planDetails,
        category: dataCategory,
        title: true,
      });
      if (!categoryInfo) {
        handleCloseDrawer(true);
        return;
      }
      openDrawer(
        () => (
          <CategoryUsageDrawer
            categoryInfo={categoryInfo}
            stats={usageData.stats[dataCategory] ?? []}
            subscription={subscription}
            periodStart={usageData.periodStart}
            periodEnd={usageData.periodEnd}
            eventTotals={usageData.eventTotals?.[dataCategory] ?? {}}
            totals={usageData.totals[dataCategory] ?? EMPTY_STAT_TOTAL}
          />
        ),
        {
          ariaLabel: t('Usage for %s', productName),
          drawerKey: 'usage-overview-drawer',
          resizable: false,
          onClose: () => handleCloseDrawer(false),
          drawerWidth: '650px',
        }
      );
    }
  }, [
    isDrawerOpen,
    location.query.drawer,
    usageData,
    subscription,
    openDrawer,
    handleCloseDrawer,
  ]);

  const allAddOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOn => addOn.dataCategories);

  const columnOrder: GridColumnOrder[] = useMemo(() => {
    const hasAnyPotentialOrActiveProductTrial = subscription.productTrials?.some(
      trial =>
        !trial.isStarted ||
        (trial.isStarted && getDaysSinceDate(trial.endDate ?? '') <= 0)
    );
    return [
      {key: 'product', name: t('Product'), width: 300},
      {key: 'currentUsage', name: t('Current usage'), width: 200},
      {key: 'reservedUsage', name: t('Reserved usage'), width: 200},
      {key: 'reservedSpend', name: t('Reserved spend'), width: 200},
      {
        key: 'budgetSpend',
        name: t('%s spend', displayBudgetName(subscription.planDetails, {title: true})),
        width: 200,
      },
      {
        key: 'trialInfo',
        name: '',
        width: 50,
      },
    ].filter(
      column =>
        (hasBillingPerms || !column.key.endsWith('Spend')) &&
        (subscription.canSelfServe ||
          !column.key.endsWith('Spend') ||
          ((subscription.onDemandInvoiced || subscription.onDemandInvoicedManual) &&
            column.key === 'budgetSpend')) &&
        (hasAnyPotentialOrActiveProductTrial || column.key !== 'trialInfo')
    );
  }, [
    hasBillingPerms,
    subscription.planDetails,
    subscription.productTrials,
    subscription.canSelfServe,
    subscription.onDemandInvoiced,
    subscription.onDemandInvoicedManual,
  ]);

  // TODO(isabella): refactor this to have better types
  const productData: Array<{
    budgetSpend: number;
    currentUsage: number;
    hasAccess: boolean;
    isPaygOnly: boolean;
    isUnlimited: boolean;
    product: string;
    addOnCategory?: AddOnCategory;
    ariaLabel?: string;
    dataCategory?: DataCategory;
    free?: number;
    isChildProduct?: boolean;
    isOpen?: boolean;
    productTrialCategory?: DataCategory;
    reserved?: number;
    reservedSpend?: number;
    reservedUsage?: number;
    softCapType?: 'ON_DEMAND' | 'TRUE_FORWARD';
    toggleKey?: DataCategory | AddOnCategory;
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
          const softCapType =
            metricHistory.softCapType ??
            (metricHistory.trueForward ? 'TRUE_FORWARD' : undefined);
          const activeProductTrial = getActiveProductTrial(
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
            dataCategory: category,
            hasAccess,
            isPaygOnly,
            free,
            reserved,
            isUnlimited: !!activeProductTrial || reserved === UNLIMITED_RESERVED,
            softCapType: softCapType ?? undefined,
            product: productName,
            currentUsage: total,
            reservedUsage: percentUsed,
            reservedSpend: recurringReservedSpend,
            budgetSpend: paygTotal,
            productTrialCategory: category,
          };
        }),
      ...Object.entries(subscription.addOns ?? {})
        .filter(
          // show add-ons regardless of whether they're enabled
          // as long as they're launched for the org
          ([_, addOnInfo]) =>
            !addOnInfo.billingFlag ||
            organization.features.includes(addOnInfo.billingFlag)
        )
        .flatMap(([apiName, addOnInfo]) => {
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
            ? getPercentage(
                reservedBudget?.totalReservedSpend,
                reservedBudget?.reservedBudget
              )
            : undefined;
          const activeProductTrial = getActiveProductTrial(
            subscription.productTrials ?? [],
            addOnDataCategories[0] as DataCategory
          );
          const hasAccess = addOnInfo.enabled;

          let bucket: EventBucket | undefined = undefined;
          if (hasAccess) {
            // NOTE: this only works for reserved budget add-ons,
            // returning the first sub-category bucket that has a price
            // for the reserved budget tier (RESERVED_BUDGET_QUOTA)
            let i = 0;
            while (!bucket?.price && i < addOnDataCategories.length) {
              bucket = getBucket({
                buckets: subscription.planDetails.planCategories[addOnDataCategories[i]!],
                events: RESERVED_BUDGET_QUOTA,
              });
              i++;
            }
          }
          const recurringReservedSpend = bucket?.price ?? 0;

          // Only show child categories if the add-on is open and enabled
          const childCategoriesData =
            openState[apiName] && hasAccess
              ? addOnInfo.dataCategories.map(addOnDataCategory => {
                  const childSpend =
                    reservedBudget?.categories[addOnDataCategory]?.reservedSpend ?? 0;
                  const childPaygTotal =
                    subscription.categories[addOnDataCategory]?.onDemandSpendUsed ?? 0;
                  const childProductName = getPlanCategoryName({
                    plan: subscription.planDetails,
                    category: addOnDataCategory,
                    title: true,
                  });
                  const metricHistory = subscription.categories[addOnDataCategory];
                  const softCapType =
                    metricHistory?.softCapType ??
                    (metricHistory?.trueForward ? 'TRUE_FORWARD' : undefined);
                  return {
                    addOnCategory: apiName as AddOnCategory,
                    dataCategory: addOnDataCategory,
                    isChildProduct: true,
                    isOpen: openState[apiName],
                    hasAccess: true,
                    isPaygOnly: false,
                    isUnlimited: !!activeProductTrial,
                    softCapType: softCapType ?? undefined,
                    budgetSpend: childPaygTotal,
                    currentUsage: (childSpend ?? 0) + childPaygTotal,
                    product: childProductName,
                  };
                })
              : null;

          return [
            {
              addOnCategory: apiName as AddOnCategory,
              hasAccess,
              free: reservedBudget?.freeBudget ?? 0,
              reserved: reservedBudget?.reservedBudget ?? 0,
              isPaygOnly: !reservedBudget,
              isOpen: openState[apiName],
              toggleKey: hasAccess ? (apiName as AddOnCategory) : undefined,
              isUnlimited: !!activeProductTrial,
              productTrialCategory: addOnDataCategories[0] as DataCategory,
              product: addOnName,
              currentUsage: (reservedBudget?.totalReservedSpend ?? 0) + paygTotal,
              reservedUsage: percentUsed,
              reservedSpend: recurringReservedSpend,
              budgetSpend: paygTotal,
            },
            ...(childCategoriesData ?? []),
          ];
        }),
    ];
  }, [subscription, allAddOnDataCategories, organization.features, openState]);

  return (
    <GridEditable
      bodyStyle={{
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '0px',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        marginBottom: '0px',
      }}
      fit="max-content"
      columnOrder={columnOrder}
      data={productData}
      columnSortBy={[]}
      grid={{
        renderHeadCell: column => {
          return <Text>{column.name}</Text>;
        },
        renderBodyCell: (column, row) => {
          const {
            currentUsage,
            hasAccess,
            isPaygOnly,
            isUnlimited,
            product,
            addOnCategory,
            dataCategory,
            free,
            isChildProduct,
            isOpen,
            reserved,
            reservedUsage,
            softCapType,
            toggleKey,
            productTrialCategory,
          } = row;

          const productTrial = productTrialCategory
            ? (getActiveProductTrial(
                subscription.productTrials ?? [],
                productTrialCategory
              ) ??
              getPotentialProductTrial(
                subscription.productTrials ?? [],
                productTrialCategory
              ))
            : undefined;

          if (defined(isOpen) && !isOpen && isChildProduct) {
            return null;
          }

          switch (column.key) {
            case 'product': {
              const title = (
                <Text bold textWrap="balance">
                  {!hasAccess && <IconLock locked size="xs" />} {product}
                  {softCapType &&
                    ` (${toTitleCase(softCapType.replace(/_/g, ' ').toLocaleLowerCase())})`}{' '}
                </Text>
              );

              if (toggleKey) {
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
                      aria-label={
                        isOpen
                          ? t('Collapse %s details', product)
                          : t('Expand %s details', product)
                      }
                      onClick={() =>
                        setOpenState(prev => ({...prev, [toggleKey as string]: !isOpen}))
                      }
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
              const formattedTotal = addOnCategory
                ? displayPriceWithCents({cents: currentUsage})
                : dataCategory
                  ? formatUsageWithUnits(currentUsage, dataCategory, {
                      useUnitScaling: true,
                    })
                  : currentUsage;
              const formattedReserved = addOnCategory
                ? displayPriceWithCents({cents: reserved ?? 0})
                : dataCategory
                  ? formatReservedWithUnits(reserved ?? 0, dataCategory, {
                      useUnitScaling: true,
                    })
                  : (reserved ?? 0);
              const formattedFree = addOnCategory
                ? displayPriceWithCents({cents: free ?? 0})
                : dataCategory
                  ? formatReservedWithUnits(free ?? 0, dataCategory, {
                      useUnitScaling: true,
                    })
                  : (free ?? 0);
              const formattedReservedTotal = addOnCategory
                ? displayPriceWithCents({cents: (reserved ?? 0) + (free ?? 0)})
                : dataCategory
                  ? formatReservedWithUnits((reserved ?? 0) + (free ?? 0), dataCategory, {
                      useUnitScaling: true,
                    })
                  : (reserved ?? 0) + (free ?? 0);
              const formattedCurrentUsage =
                isPaygOnly || isChildProduct
                  ? formattedTotal
                  : `${formattedTotal} / ${formattedReservedTotal}`;

              return (
                <Flex align="center" gap="sm">
                  <Text as="div" textWrap="balance">
                    {isUnlimited ? UNLIMITED : formattedCurrentUsage}{' '}
                    {!(isPaygOnly || isChildProduct) && (
                      <QuestionTooltip
                        size="xs"
                        position="top"
                        title={
                          isUnlimited
                            ? t('Unlimited usage during your product trial')
                            : tct('[formattedReserved] reserved[freeString]', {
                                formattedReserved,
                                freeString: free
                                  ? tct(' + [formattedFree] gifted', {formattedFree})
                                  : '',
                              })
                        }
                      />
                    )}
                  </Text>
                </Flex>
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

              if (isUnlimited) {
                return <Text>{UNLIMITED}</Text>;
              }

              const percentUsed = reservedUsage;
              if (defined(percentUsed)) {
                return (
                  <Flex gap="sm" align="center">
                    <ReservedUsageBar percentUsed={percentUsed / 100} />
                    <Text>{percentUsed.toFixed(0) + '%'}</Text>
                  </Flex>
                );
              }
              return <div />;
            }
            case 'reservedSpend':
            case 'budgetSpend': {
              const spend = row[column.key as keyof typeof row];
              const formattedSpend = spend
                ? displayPriceWithCents({cents: spend as number})
                : '-';
              return <CurrencyCell>{formattedSpend}</CurrencyCell>;
            }
            case 'trialInfo': {
              if (productTrial) {
                return (
                  <Container>
                    {productTrial.isStarted ? (
                      <Container>
                        <ProductTrialTag trial={productTrial} />
                      </Container>
                    ) : (
                      <StartTrialButton
                        organization={organization}
                        source="usage-overview"
                        requestData={{
                          productTrial: {
                            category: productTrial.category,
                            reasonCode: productTrial.reasonCode,
                          },
                        }}
                        aria-label={t('Start 14 day free %s trial', product)}
                        priority="primary"
                        handleClick={() => {
                          setTrialButtonBusyState(prev => ({
                            ...prev,
                            [productTrial.category]: true,
                          }));
                        }}
                        onTrialStarted={() => {
                          setTrialButtonBusyState(prev => ({
                            ...prev,
                            [productTrial.category]: true,
                          }));
                        }}
                        onTrialFailed={() => {
                          setTrialButtonBusyState(prev => ({
                            ...prev,
                            [productTrial.category]: false,
                          }));
                        }}
                        busy={trialButtonBusyState[productTrial.category]}
                        disabled={trialButtonBusyState[productTrial.category]}
                        size="xs"
                      >
                        <Flex align="center" gap="sm">
                          <IconLightning size="xs" />
                          <Container>{t('Start 14 day free trial')}</Container>
                        </Flex>
                      </StartTrialButton>
                    )}
                  </Container>
                );
              }
              return <div />;
            }
            default:
              return row[column.key as keyof typeof row];
          }
        },
      }}
      isRowClickable={row =>
        !!row.dataCategory &&
        getCategoryInfoFromPlural(row.dataCategory)?.tallyType === 'usage'
      }
      onRowClick={row => {
        if (row.dataCategory) {
          const categoryInfo = getCategoryInfoFromPlural(row.dataCategory);
          if (categoryInfo?.tallyType === 'usage') {
            navigate({
              pathname: location.pathname,
              query: {...location.query, drawer: row.dataCategory},
            });
          }
        }
      }}
      getRowAriaLabel={row => {
        if (row.dataCategory) {
          const categoryInfo = getCategoryInfoFromPlural(row.dataCategory);
          if (categoryInfo?.tallyType === 'usage') {
            return t('View %s usage', row.product);
          }
        }
        return undefined;
      }}
    />
  );
}

function UsageOverview({subscription, organization, usageData}: UsageOverviewProps) {
  const hasBillingPerms = organization.access.includes('org:billing');
  const {isCollapsed: navIsCollapsed, layout} = useNavContext();
  const {currentHistory, isPending, isError} = useCurrentBillingHistory();
  return (
    <Container
      radius="md"
      border="primary"
      background="primary"
      // XXX: this is a very hacky way to ensure that if columns are resized, it doesn't
      // make the page wider than the viewport
      // sidebar = 74px; secondary nav = 190px;
      maxWidth={
        layout === NavLayout.MOBILE
          ? '100vw'
          : navIsCollapsed
            ? 'calc(100vw - 74px)'
            : 'calc(100vw - 74px - 190px)'
      }
    >
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
        {hasBillingPerms && (
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
        )}
      </Flex>
      <UsageOverviewTable
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
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
