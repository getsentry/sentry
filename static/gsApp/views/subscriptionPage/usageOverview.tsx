import {Fragment, useEffect, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tooltip} from '@sentry/scraps/tooltip';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ProgressRing from 'sentry/components/progressRing';
import {
  IconClock,
  IconDownload,
  IconEllipsis,
  IconLightning,
  IconLock,
  IconTable,
  IconWarning,
} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

import {GIGABYTE, UNLIMITED_RESERVED} from 'getsentry/constants';
import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import {
  AddOnCategory,
  type CustomerUsage,
  type ProductTrial,
  type Subscription,
} from 'getsentry/types';
import {
  checkIsAddOn,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getBilledCategory,
  getPercentage,
  getPotentialProductTrial,
  getReservedBudgetCategoryForAddOn,
  MILLISECONDS_IN_HOUR,
  productIsEnabled,
  supportsPayg,
} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
  sortCategories,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';
import ProductBreakdownPanel from 'getsentry/views/subscriptionPage/productBreakdownPanel';

interface UsageOverviewProps {
  organization: Organization;
  subscription: Subscription;
}

function ProductTrialRibbon({
  activeProductTrial,
  potentialProductTrial,
}: {
  activeProductTrial: ProductTrial | null;
  potentialProductTrial: ProductTrial | null;
}) {
  const theme = useTheme();
  const iconProps = {
    size: 'xs' as const,
    color: 'white' as const,
  };
  const ribbonColor = activeProductTrial
    ? theme.tokens.graphics.promotion
    : theme.tokens.graphics.accent;

  if (!activeProductTrial && !potentialProductTrial) {
    return null;
  }

  const trialDaysLeft = -1 * getDaysSinceDate(activeProductTrial?.endDate ?? '');
  const tooltipContent = potentialProductTrial
    ? t('Trial available')
    : tn('%s day left', '%s days left', trialDaysLeft);

  return (
    <Flex position="absolute" style={{left: '-1px', top: '14px'}} z-index="1000">
      <RibbonBase ribbonColor={ribbonColor}>
        <Tooltip title={tooltipContent}>
          {activeProductTrial ? (
            <IconClock {...iconProps} />
          ) : (
            <IconLightning {...iconProps} />
          )}
        </Tooltip>
      </RibbonBase>
      <Flex direction="column" position="relative">
        <TopRibbonEdge ribbonColor={ribbonColor} />
        <BottomRibbonEdge ribbonColor={ribbonColor} />
      </Flex>
    </Flex>
  );
}

function ProductRow({
  organization,
  product,
  selectedProduct,
  onRowClick,
  subscription,
  isChildProduct,
  parentProduct,
  usageData,
}: {
  onRowClick: (category: DataCategory | AddOnCategory) => void;
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
  usageData: CustomerUsage;
} & (
  | {
      isChildProduct: true;
      parentProduct: DataCategory | AddOnCategory;
      product: DataCategory;
    }
  | {
      product: DataCategory | AddOnCategory;
      isChildProduct?: false;
      parentProduct?: never;
    }
)) {
  const theme = useTheme();
  const {layout: navLayout} = useNavContext();
  const isMobile = navLayout === NavLayout.MOBILE;
  const [isHovered, setIsHovered] = useState(false);
  const showAdditionalSpendColumn =
    subscription.canSelfServe || supportsPayg(subscription);
  const isAddOn = checkIsAddOn(parentProduct ?? product);
  const billedCategory = getBilledCategory(subscription, product);
  if (!billedCategory) {
    return null;
  }

  const metricHistory = subscription.categories[billedCategory];
  if (!metricHistory) {
    return null;
  }

  const isEnabled = productIsEnabled(subscription, parentProduct ?? product);

  if (!isEnabled && isChildProduct) {
    // don't show child product rows if the parent product is not enabled
    return null;
  }

  let displayName = '';
  let percentUsed = 0;
  let formattedUsage = '';
  let formattedPrepaid = null;
  let paygSpend = 0;

  if (isAddOn) {
    const addOnInfo = subscription.addOns?.[(parentProduct ?? product) as AddOnCategory];
    if (!addOnInfo) {
      return null;
    }
    const {productName} = addOnInfo;
    displayName = isChildProduct
      ? getPlanCategoryName({
          plan: subscription.planDetails,
          category: product,
          title: true,
        })
      : toTitleCase(productName, {allowInnerUpperCase: true});

    const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(
      (parentProduct ?? product) as AddOnCategory
    );
    const reservedBudget = subscription.reservedBudgets?.find(
      budget => budget.apiName === reservedBudgetCategory
    );
    percentUsed = reservedBudget
      ? getPercentage(metricHistory.usage, reservedBudget.reservedBudget)
      : 0;
    formattedUsage = reservedBudget
      ? isChildProduct
        ? displayPriceWithCents({
            cents: reservedBudget.categories[product]?.reservedSpend ?? 0,
          })
        : displayPriceWithCents({cents: reservedBudget.totalReservedSpend})
      : formatUsageWithUnits(metricHistory.usage, billedCategory, {
          isAbbreviated: true,
          useUnitScaling: true,
        });

    if (reservedBudget) {
      formattedPrepaid = displayPriceWithCents({cents: reservedBudget.reservedBudget});
    }

    paygSpend = isChildProduct
      ? (subscription.categories[product]?.onDemandSpendUsed ?? 0)
      : addOnInfo.dataCategories.reduce((acc, category) => {
          return acc + (subscription.categories[category]?.onDemandSpendUsed ?? 0);
        }, 0);
  } else {
    displayName = getPlanCategoryName({
      plan: subscription.planDetails,
      category: billedCategory,
      title: true,
    });
    // convert prepaid amount to the same unit as usage to accurately calculate percent used
    const {prepaid} = metricHistory;
    const isUnlimited = prepaid === UNLIMITED_RESERVED;
    const rawPrepaid = isUnlimited
      ? prepaid
      : isByteCategory(billedCategory)
        ? prepaid * GIGABYTE
        : isContinuousProfiling(billedCategory)
          ? prepaid * MILLISECONDS_IN_HOUR
          : prepaid;
    percentUsed = rawPrepaid ? getPercentage(metricHistory.usage, rawPrepaid) : 0;

    formattedUsage = formatUsageWithUnits(metricHistory.usage, billedCategory, {
      isAbbreviated: true,
      useUnitScaling: true,
    });
    formattedPrepaid = formatReservedWithUnits(prepaid, billedCategory, {
      useUnitScaling: true,
      isAbbreviated: true,
    });

    paygSpend = subscription.categories[billedCategory]?.onDemandSpendUsed ?? 0;
  }

  const {reserved} = metricHistory;
  const bucket = getBucket({
    events: reserved ?? 0, // buckets use the converted unit reserved amount (ie. in GB for byte categories)
    buckets: subscription.planDetails.planCategories[billedCategory],
  });
  const recurringReservedSpend = isChildProduct ? 0 : (bucket.price ?? 0);
  const additionalSpend = recurringReservedSpend + paygSpend;

  const activeProductTrial = isChildProduct
    ? null
    : getActiveProductTrial(subscription.productTrials ?? null, billedCategory);
  const potentialProductTrial = isChildProduct
    ? null
    : getPotentialProductTrial(subscription.productTrials ?? null, billedCategory);
  const usageExceeded = subscription.categories[billedCategory]?.usageExceeded ?? false;
  const isPaygOnly =
    !isAddOn && supportsPayg(subscription) && metricHistory.reserved === 0;

  const isClickable = !!potentialProductTrial || isEnabled;
  const isSelected = selectedProduct === product;

  return (
    <Fragment>
      <TableRow
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        isClickable={isClickable}
        isSelected={isSelected}
        onClick={() => (isClickable ? onRowClick(product) : undefined)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
            onRowClick(product);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={t('View %s usage', displayName)}
      >
        {(activeProductTrial || potentialProductTrial) && (
          <ProductTrialRibbon
            activeProductTrial={activeProductTrial}
            potentialProductTrial={potentialProductTrial}
          />
        )}
        <Flex
          paddingLeft={
            activeProductTrial || potentialProductTrial
              ? 'lg'
              : isChildProduct
                ? '2xl'
                : undefined
          }
          gap="sm"
          align="center"
        >
          <Text variant={isEnabled ? 'primary' : 'muted'}>{displayName}</Text>
          {!isEnabled && <IconLock size="sm" locked color="disabled" />}
        </Flex>
        {isEnabled && (
          <Fragment>
            <Flex align="center" gap="xs">
              {usageExceeded ? (
                <IconWarning size="sm" color="danger" />
              ) : isPaygOnly ||
                isChildProduct ||
                reserved === UNLIMITED_RESERVED ? null : (
                <ProgressRing
                  value={percentUsed}
                  progressColor={
                    !usageExceeded && percentUsed === 100 ? theme.warningFocus : undefined
                  }
                />
              )}
              <Text>
                {isPaygOnly || isChildProduct || !formattedPrepaid
                  ? formattedUsage
                  : `${formattedUsage} / ${formattedPrepaid}`}
              </Text>
            </Flex>
            {showAdditionalSpendColumn && (
              <Text align="right">{displayPriceWithCents({cents: additionalSpend})}</Text>
            )}
          </Fragment>
        )}
        {(isSelected || isHovered) && <SelectedPill isSelected={isSelected} />}
      </TableRow>
      {isMobile && isSelected && (
        <ProductBreakdownPanel
          organization={organization}
          selectedProduct={selectedProduct}
          subscription={subscription}
          usageData={usageData}
        />
      )}
    </Fragment>
  );
}

function UsageOverviewTable({
  organization,
  subscription,
  onRowClick,
  selectedProduct,
  usageData,
}: UsageOverviewProps & {
  onRowClick: (category: DataCategory | AddOnCategory) => void;
  selectedProduct: DataCategory | AddOnCategory;
  usageData: CustomerUsage;
}) {
  const addOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOnInfo => addOnInfo.dataCategories);
  const sortedCategories = sortCategories(subscription.categories);
  const showAdditionalSpendColumn =
    subscription.canSelfServe || supportsPayg(subscription);

  return (
    <Grid
      columns="max-content auto max-content"
      background="primary"
      borderTop="primary"
      radius="0 0 md md"
      gap="0 3xl"
      width="100%"
    >
      <TableHeader>
        <Text bold variant="muted" uppercase>
          {t('Feature')}
        </Text>
        <Text bold variant="muted" uppercase>
          {t('Usage')}
        </Text>
        {showAdditionalSpendColumn && (
          <Text bold variant="muted" align="right" uppercase>
            {t('Additional spend')}
          </Text>
        )}
      </TableHeader>
      {sortedCategories
        .filter(
          categoryInfo =>
            // filter out data categories that are part of add-ons
            // unless they are unlimited
            !addOnDataCategories.includes(categoryInfo.category) ||
            categoryInfo.reserved === UNLIMITED_RESERVED
        )
        .map(categoryInfo => {
          const {category} = categoryInfo;

          return (
            <ProductRow
              key={category}
              product={category}
              selectedProduct={selectedProduct}
              onRowClick={onRowClick}
              subscription={subscription}
              usageData={usageData}
              organization={organization}
            />
          );
        })}
      {Object.values(subscription.planDetails.addOnCategories)
        .filter(
          // show add-ons regardless of whether they're enabled
          // as long as they're launched for the org
          // and none of their sub-categories are unlimited
          // Also do not show Seer if the legacy Seer add-on is enabled
          addOnInfo =>
            (!addOnInfo.billingFlag ||
              organization.features.includes(addOnInfo.billingFlag)) &&
            !addOnInfo.dataCategories.some(
              category =>
                subscription.categories[category]?.reserved === UNLIMITED_RESERVED
            ) &&
            (addOnInfo.apiName !== AddOnCategory.SEER ||
              !subscription.addOns?.[AddOnCategory.LEGACY_SEER]?.enabled)
        )
        .map(addOnInfo => {
          const {apiName, dataCategories} = addOnInfo;
          const billedCategory = getBilledCategory(subscription, apiName);
          if (!billedCategory) {
            return null;
          }

          return (
            <Fragment key={apiName}>
              <ProductRow
                product={apiName}
                selectedProduct={selectedProduct}
                onRowClick={onRowClick}
                subscription={subscription}
                usageData={usageData}
                organization={organization}
              />
              {sortedCategories
                .filter(categoryInfo => dataCategories.includes(categoryInfo.category))
                .map(categoryInfo => {
                  const {category} = categoryInfo;

                  return (
                    <ProductRow
                      key={category}
                      product={category}
                      selectedProduct={selectedProduct}
                      onRowClick={onRowClick}
                      subscription={subscription}
                      isChildProduct
                      parentProduct={apiName}
                      usageData={usageData}
                      organization={organization}
                    />
                  );
                })}
            </Fragment>
          );
        })}
    </Grid>
  );
}

function UsageOverviewActions({organization}: {organization: Organization}) {
  const {layout: navLayout} = useNavContext();
  const isMobile = navLayout === NavLayout.MOBILE;

  const {currentHistory, isPending, isError} = useCurrentBillingHistory();
  const hasBillingPerms = organization.access.includes('org:billing');
  if (!hasBillingPerms) {
    return null;
  }

  const buttons: Array<{
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    onClick?: () => void;
    to?: string;
  }> = [
    {
      label: t('View all usage'),
      to: '/settings/billing/usage/',
      icon: <IconTable />,
    },
    {
      label: t('Download as CSV'),
      icon: <IconDownload />,
      onClick: () => {
        trackGetsentryAnalytics('subscription_page.download_reports.clicked', {
          organization,
          reportType: 'summary',
        });
        if (currentHistory) {
          window.open(currentHistory.links.csv, '_blank');
        }
      },
      disabled: isPending || isError,
    },
  ];

  if (isMobile) {
    return (
      <DropdownMenu
        triggerProps={{
          'aria-label': t('More Actions'),
          icon: <IconEllipsis />,
          showChevron: false,
          size: 'sm',
        }}
        items={buttons.map(buttonInfo => ({
          key: buttonInfo.label,
          label: buttonInfo.label,
          onAction: buttonInfo.onClick,
          to: buttonInfo.to,
          disabled: buttonInfo.disabled,
        }))}
      />
    );
  }

  return (
    <Flex gap="lg" direction={{xs: 'column', sm: 'row'}}>
      {buttons.map(buttonInfo =>
        buttonInfo.to ? (
          <LinkButton
            key={buttonInfo.label}
            icon={buttonInfo.icon}
            priority="default"
            to={buttonInfo.to}
          >
            {buttonInfo.label}
          </LinkButton>
        ) : (
          <Button
            key={buttonInfo.label}
            icon={buttonInfo.icon}
            priority="default"
            onClick={buttonInfo.onClick}
            disabled={buttonInfo.disabled}
          >
            {buttonInfo.label}
          </Button>
        )
      )}
    </Flex>
  );
}

function UsageOverview({
  subscription,
  organization,
  usageData,
}: UsageOverviewProps & {usageData: CustomerUsage}) {
  const [selectedProduct, setSelectedProduct] = useState<DataCategory | AddOnCategory>(
    DataCategory.ERRORS
  );
  const navigate = useNavigate();
  const location = useLocation();
  const {isCollapsed: navIsCollapsed} = useNavContext();
  const {layout: navLayout} = useNavContext();
  const isMobile = navLayout === NavLayout.MOBILE;

  const startDate = moment(subscription.onDemandPeriodStart);
  const endDate = moment(subscription.onDemandPeriodEnd);
  const startsAndEndsSameYear = startDate.year() === endDate.year();

  useEffect(() => {
    if (location.query.product) {
      const productFromQuery = location.query.product as DataCategory;
      if (selectedProduct !== productFromQuery) {
        setSelectedProduct(productFromQuery);
      }
    }
  }, [location.query.product, selectedProduct]);

  return (
    <Grid
      columns={{xs: '1fr', md: navIsCollapsed ? `3fr 2fr` : '1fr', lg: '3fr 2fr'}}
      gap="lg"
      align="start"
    >
      <Container radius="md" border="primary" background="primary" width="100%">
        <Flex
          justify="between"
          align={{xs: 'start', sm: 'center'}}
          padding="lg xl"
          gap="xl"
          direction={{xs: 'column', sm: 'row'}}
        >
          <Flex direction="column" gap="sm">
            <Heading as="h3" size="lg">
              {tct('Usage: [period]', {
                period: `${startDate.format(startsAndEndsSameYear ? 'MMM D' : 'MMM D, YYYY')} - ${endDate.format('MMM D, YYYY')}`,
              })}
            </Heading>
          </Flex>
          <UsageOverviewActions organization={organization} />
        </Flex>
        <UsageOverviewTable
          subscription={subscription}
          organization={organization}
          onRowClick={product => {
            setSelectedProduct(product);
            trackGetsentryAnalytics('subscription_page.usage_overview.row_clicked', {
              organization,
              subscription,
              ...(Object.values(AddOnCategory).includes(product as AddOnCategory)
                ? {addOnCategory: product as AddOnCategory}
                : {dataCategory: product as DataCategory}),
            });
            navigate(
              {
                pathname: location.pathname,
                query: {
                  ...location.query,
                  product,
                },
              },
              {replace: true}
            );
          }}
          selectedProduct={selectedProduct}
          usageData={usageData}
        />
      </Container>
      {!isMobile && (
        <ProductBreakdownPanel
          organization={organization}
          selectedProduct={selectedProduct}
          subscription={subscription}
          usageData={usageData}
        />
      )}
    </Grid>
  );
}

export default UsageOverview;

const TableHeader = styled('th')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  text-transform: uppercase;
  padding: ${p => p.theme.space.xl};
`;

const TableRow = styled('tr')<{isClickable: boolean; isSelected: boolean}>`
  position: relative;
  background: ${p => (p.isSelected ? p.theme.backgroundSecondary : p.theme.background)};
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  padding: ${p => p.theme.space.xl};
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }

  ${p =>
    p.isClickable &&
    css`
      cursor: pointer;

      &:hover {
        background: ${p.theme.backgroundSecondary};
      }
    `}
`;

const SelectedPill = styled('div')<{isSelected: boolean}>`
  position: absolute;
  right: -1px;
  top: 14px;
  width: 4px;
  height: 22px;
  border-radius: 2px;
  background: ${p =>
    p.isSelected ? p.theme.tokens.graphics.accent : p.theme.tokens.graphics.muted};
`;

const RibbonBase = styled('div')<{ribbonColor: string}>`
  width: 20px;
  height: 22px;
  background: ${p => p.ribbonColor};
  padding: ${p => `${p.theme.space['2xs']} ${p.theme.space.xs}`};
`;

const BottomRibbonEdge = styled('div')<{ribbonColor: string}>`
  position: absolute;
  top: auto;
  bottom: 0;
  width: 0px;
  height: 0px;
  border-style: solid;
  border-color: transparent transparent ${p => p.ribbonColor} transparent;
  border-width: 11px 5.5px 11px 0px;
`;

const TopRibbonEdge = styled(BottomRibbonEdge)`
  transform: scaleY(-1);
  top: 0;
  bottom: auto;
`;
