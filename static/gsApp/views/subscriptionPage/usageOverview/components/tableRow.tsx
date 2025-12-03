import {Fragment, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ProgressRing from 'sentry/components/progressRing';
import {IconLock, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import useMedia from 'sentry/utils/useMedia';

import {GIGABYTE, UNLIMITED_RESERVED} from 'getsentry/constants';
import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {AddOnCategory} from 'getsentry/types';
import {
  formatReservedWithUnits,
  formatUsageWithUnits,
  getPercentage,
  getReservedBudgetCategoryForAddOn,
  getSoftCapType,
  MILLISECONDS_IN_HOUR,
  supportsPayg,
} from 'getsentry/utils/billing';
import {isByteCategory, isContinuousProfiling} from 'getsentry/utils/dataCategory';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';
import ProductBreakdownPanel from 'getsentry/views/subscriptionPage/usageOverview/components/panel';
import ProductTrialRibbon from 'getsentry/views/subscriptionPage/usageOverview/components/productTrialRibbon';
import {SIDE_PANEL_MIN_SCREEN_BREAKPOINT} from 'getsentry/views/subscriptionPage/usageOverview/constants';
import type {UsageOverviewTableProps} from 'getsentry/views/subscriptionPage/usageOverview/types';

interface ChildProductRowProps {
  isChildProduct: true;
  parentProduct: DataCategory | AddOnCategory;
  product: DataCategory;
}

interface ParentProductRowProps {
  product: DataCategory | AddOnCategory;
  isChildProduct?: false;
  parentProduct?: never;
}

function UsageOverviewTableRow({
  organization,
  product,
  selectedProduct,
  onRowClick,
  subscription,
  isChildProduct,
  parentProduct,
  usageData,
}: UsageOverviewTableProps & (ChildProductRowProps | ParentProductRowProps)) {
  const theme = useTheme();
  const showPanelInline = useMedia(
    `(max-width: ${theme.breakpoints[SIDE_PANEL_MIN_SCREEN_BREAKPOINT]})`
  );
  const [isHovered, setIsHovered] = useState(false);
  const showAdditionalSpendColumn =
    subscription.canSelfServe || supportsPayg(subscription);

  const {
    displayName,
    billedCategory,
    isAddOn,
    isEnabled,
    addOnInfo,
    usageExceeded,
    activeProductTrial,
    potentialProductTrial,
  } = useProductBillingMetadata(subscription, product, parentProduct, isChildProduct);
  if (!billedCategory) {
    return null;
  }

  const metricHistory = subscription.categories[billedCategory];
  if (!metricHistory) {
    return null;
  }

  if (!isEnabled && isChildProduct) {
    // don't show child product rows if the parent product is not enabled
    return null;
  }

  let percentUsed = 0;
  let formattedUsage = '';
  let formattedPrepaid = null;
  let paygSpend = 0;
  let isUnlimited = false;

  if (isAddOn) {
    if (!addOnInfo) {
      return null;
    }

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
      ? displayPriceWithCents({
          cents: isChildProduct
            ? (reservedBudget.categories[product]?.reservedSpend ?? 0)
            : reservedBudget.totalReservedSpend,
        })
      : formatUsageWithUnits(metricHistory.usage, billedCategory, {
          isAbbreviated: true,
          useUnitScaling: true,
        });

    if (isUnlimited) {
      formattedPrepaid = formatReservedWithUnits(UNLIMITED_RESERVED, billedCategory);
    } else if (reservedBudget) {
      formattedPrepaid = displayPriceWithCents({cents: reservedBudget.reservedBudget});
    }

    paygSpend = isChildProduct
      ? (subscription.categories[product]?.onDemandSpendUsed ?? 0)
      : addOnInfo.dataCategories.reduce((acc, category) => {
          return acc + (subscription.categories[category]?.onDemandSpendUsed ?? 0);
        }, 0);
  } else {
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
  const formattedDisplayName = formattedSoftCapType
    ? `${displayName} (${formattedSoftCapType})`
    : displayName;

  const isPaygOnly =
    !isAddOn && supportsPayg(subscription) && metricHistory.reserved === 0;

  const isClickable = !!potentialProductTrial || isEnabled;
  const isSelected = selectedProduct === product;

  return (
    <Fragment>
      <Row
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
            wrap="nowrap"
          >
            <Text as="span" variant={isEnabled ? 'primary' : 'muted'} textWrap="balance">
              {formattedDisplayName}{' '}
              {!isEnabled && (
                <IconContainer>
                  <IconLock size="sm" locked color="disabled" />
                </IconContainer>
              )}
            </Text>
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
      </Row>
      {showPanelInline && isSelected && (
        <tr>
          <MobilePanelContainer>
            <ProductBreakdownPanel
              organization={organization}
              selectedProduct={selectedProduct}
              subscription={subscription}
              usageData={usageData}
              isInline
            />
          </MobilePanelContainer>
        </tr>
      )}
    </Fragment>
  );
}

export default UsageOverviewTableRow;

const Row = styled('tr')<{isClickable: boolean; isSelected: boolean}>`
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

const MobilePanelContainer = styled('td')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

const SelectedPill = styled('td')<{isSelected: boolean}>`
  position: absolute;
  right: -1px;
  top: 30%;
  width: 4px;
  height: 22px;
  border-radius: 2px;
  background: ${p =>
    p.isSelected ? p.theme.tokens.graphics.accent : p.theme.tokens.graphics.muted};
`;

const IconContainer = styled('span')`
  display: inline-block;
  vertical-align: middle;
`;
