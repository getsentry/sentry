import {Fragment, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ProgressRing from 'sentry/components/progressRing';
import {IconLock, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

import {GIGABYTE, UNLIMITED_RESERVED} from 'getsentry/constants';
import {AddOnCategory, type CustomerUsage, type Subscription} from 'getsentry/types';
import {
  checkIsAddOn,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getBilledCategory,
  getPercentage,
  getPotentialProductTrial,
  getReservedBudgetCategoryForAddOn,
  getSoftCapType,
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
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';
import ProductBreakdownPanel from 'getsentry/views/subscriptionPage/usageOverview/components/productBreakdownPanel';
import ProductTrialRibbon from 'getsentry/views/subscriptionPage/usageOverview/components/productTrialRibbon';

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

  const activeProductTrial = isChildProduct
    ? null
    : getActiveProductTrial(subscription.productTrials ?? null, billedCategory);
  const potentialProductTrial = isChildProduct
    ? null
    : getPotentialProductTrial(subscription.productTrials ?? null, billedCategory);

  let displayName = '';
  let percentUsed = 0;
  let formattedUsage = '';
  let formattedPrepaid = null;
  let paygSpend = 0;
  let isUnlimited = false;

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

    isUnlimited = !!activeProductTrial;
    const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(
      (parentProduct ?? product) as AddOnCategory
    );
    const reservedBudget = subscription.reservedBudgets?.find(
      budget => budget.apiName === reservedBudgetCategory
    );
    percentUsed = reservedBudget
      ? getPercentage(reservedBudget.totalReservedSpend, reservedBudget.reservedBudget)
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

    if (isUnlimited) {
      formattedPrepaid = formatReservedWithUnits(UNLIMITED_RESERVED, billedCategory);
    } else {
      if (reservedBudget) {
        formattedPrepaid = displayPriceWithCents({cents: reservedBudget.reservedBudget});
      }
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
    isUnlimited = prepaid === UNLIMITED_RESERVED || !!activeProductTrial;
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

  const formattedSoftCapType =
    isChildProduct || !isAddOn ? getSoftCapType(metricHistory) : null;
  if (formattedSoftCapType) {
    displayName = `${displayName} (${formattedSoftCapType})`;
  }

  const usageExceeded = subscription.categories[billedCategory]?.usageExceeded ?? false;
  const isPaygOnly =
    !isAddOn && supportsPayg(subscription) && metricHistory.reserved === 0;

  const isClickable = !!potentialProductTrial || isEnabled;
  const isSelected = selectedProduct === product;

  return (
    <Fragment>
      <TableRow
        onMouseEnter={() => isClickable && setIsHovered(true)}
        onMouseLeave={() => isClickable && setIsHovered(false)}
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
        <td>
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
            <Text variant={isEnabled ? 'primary' : 'muted'} textWrap="balance">
              {displayName}
            </Text>
            {!isEnabled && <IconLock size="sm" locked color="disabled" />}
          </Flex>
        </td>
        {isEnabled && (
          <Fragment>
            <td>
              <Flex align="center" gap="xs" wrap="wrap">
                {usageExceeded ? (
                  <IconWarning size="sm" color="danger" />
                ) : isPaygOnly || isChildProduct || isUnlimited ? null : (
                  <ProgressRing
                    value={percentUsed}
                    progressColor={
                      !usageExceeded && percentUsed === 100
                        ? theme.warningFocus
                        : undefined
                    }
                  />
                )}
                <Text textWrap="balance">
                  {isPaygOnly || isChildProduct || !formattedPrepaid
                    ? formattedUsage
                    : `${formattedUsage} / ${formattedPrepaid}`}
                </Text>
              </Flex>
            </td>
            {showAdditionalSpendColumn && (
              <td>
                <Text align="right">
                  {displayPriceWithCents({cents: additionalSpend})}
                </Text>
              </td>
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
}: {
  onRowClick: (category: DataCategory | AddOnCategory) => void;
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
  usageData: CustomerUsage;
}) {
  const addOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOnInfo => addOnInfo.dataCategories);
  const sortedCategories = sortCategories(subscription.categories);
  const showAdditionalSpendColumn =
    subscription.canSelfServe || supportsPayg(subscription);

  return (
    <Table>
      <thead>
        <TableHeaderRow>
          <th>
            <Text bold variant="muted" uppercase>
              {t('Feature')}
            </Text>
          </th>
          <th>
            <Text bold variant="muted" uppercase>
              {t('Usage')}
            </Text>
          </th>
          {showAdditionalSpendColumn && (
            <th>
              <Text bold variant="muted" align="right" uppercase>
                {t('Additional spend')}
              </Text>
            </th>
          )}
        </TableHeaderRow>
      </thead>
      <tbody>
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
      </tbody>
    </Table>
  );
}

export default UsageOverviewTable;

const Table = styled('table')`
  display: grid;
  grid-template-columns: max-content auto max-content;
  background: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.border};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  gap: 0 ${p => p.theme.space['3xl']};
  width: 100%;
  margin: 0;

  thead,
  tbody,
  tr {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
  }

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(3, auto);
  }
`;

const TableHeaderRow = styled('tr')`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  text-transform: uppercase;
  padding: ${p => p.theme.space.xl};
`;

const TableRow = styled('tr')<{isClickable: boolean; isSelected: boolean}>`
  position: relative;
  background: ${p => (p.isSelected ? p.theme.backgroundSecondary : p.theme.background)};
  padding: ${p => p.theme.space.xl};
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }

  cursor: default;

  ${p =>
    p.isClickable &&
    css`
      cursor: pointer;

      &:hover {
        background: ${p.theme.backgroundSecondary};
      }
    `}
`;

const SelectedPill = styled('td')<{isSelected: boolean}>`
  position: absolute;
  right: -1px;
  top: 14px;
  width: 4px;
  height: 22px;
  border-radius: 2px;
  background: ${p =>
    p.isSelected ? p.theme.tokens.graphics.accent : p.theme.tokens.graphics.muted};
`;
