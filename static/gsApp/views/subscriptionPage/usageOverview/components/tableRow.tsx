import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';

import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ProgressRing from 'sentry/components/progressRing';
import {IconClock, IconLock, IconPlay, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import useMedia from 'sentry/utils/useMedia';

import StartTrialButton from 'getsentry/components/startTrialButton';
import {GIGABYTE, UNLIMITED_RESERVED} from 'getsentry/constants';
import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {AddOnCategory, type ProductTrial} from 'getsentry/types';
import {
  formatReservedWithUnits,
  formatUsageWithUnits,
  getPercentage,
  getReservedBudgetCategoryForAddOn,
  getSoftCapType,
  MILLISECONDS_IN_HOUR,
  normalizeMetricHistory,
  supportsPayg,
} from 'getsentry/utils/billing';
import {
  calculateSeerUserSpend,
  formatCategoryQuantityWithDisplayName,
  isByteCategory,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';
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

type UsageOverviewTableRowProps = UsageOverviewTableProps &
  (ChildProductRowProps | ParentProductRowProps);

type DisabledProductRowProps = Omit<UsageOverviewTableRowProps, 'isChildProduct'> & {
  displayName: string;
  potentialProductTrial: ProductTrial | null;
  showPanelInline: boolean;
};

function UsageOverviewTableRow({
  organization,
  product,
  selectedProduct,
  onRowClick,
  subscription,
  isChildProduct,
  parentProduct,
  usageData,
}: UsageOverviewTableRowProps) {
  const theme = useTheme();
  const showPanelInline = useMedia(
    `(max-width: calc(${theme.breakpoints[SIDE_PANEL_MIN_SCREEN_BREAKPOINT]} - 1px))`
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
  } = useProductBillingMetadata(subscription, product, parentProduct);
  if (!billedCategory || (!isEnabled && isChildProduct)) {
    // don't show child product rows if the parent product is not enabled
    return null;
  }

  const metricHistory = subscription.categories[billedCategory];

  const normalizedMetricHistory = normalizeMetricHistory(billedCategory, metricHistory);
  const {reserved, usage, prepaid, free} = normalizedMetricHistory;

  if (!isEnabled) {
    return (
      <DisabledProductRow
        product={product}
        onRowClick={onRowClick}
        displayName={displayName}
        potentialProductTrial={potentialProductTrial}
        showPanelInline={showPanelInline}
        organization={organization}
        selectedProduct={selectedProduct}
        usageData={usageData}
        subscription={subscription}
      />
    );
  }
  let percentUsed = 0;
  let formattedUsage = '';
  let formattedPrepaid = null;
  let formattedFree = null;
  let paygSpend = 0;
  let isUnlimited = false;
  let otherSpend = 0;

  if (isAddOn) {
    if (!addOnInfo) {
      return null;
    }

    isUnlimited = !!activeProductTrial || prepaid === UNLIMITED_RESERVED;
    const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(
      (parentProduct ?? product) as AddOnCategory
    );
    const reservedBudget = subscription.reservedBudgets?.find(
      budget => budget.apiName === reservedBudgetCategory
    );
    formattedUsage = reservedBudget
      ? displayPriceWithCents({
          cents: isChildProduct
            ? (reservedBudget.categories[product]?.reservedSpend ?? 0)
            : reservedBudget.totalReservedSpend,
        })
      : formatUsageWithUnits(usage, billedCategory, {
          isAbbreviated: true,
          useUnitScaling: true,
        });

    if (isUnlimited) {
      percentUsed = 0;
      formattedPrepaid = formatReservedWithUnits(UNLIMITED_RESERVED, billedCategory);
    } else if (reservedBudget) {
      percentUsed = getPercentage(
        reservedBudget.totalReservedSpend,
        reservedBudget.reservedBudget
      );
      formattedPrepaid = displayPriceWithCents({cents: reservedBudget.reservedBudget});
      formattedFree = reservedBudget.freeBudget
        ? displayPriceWithCents({cents: reservedBudget.freeBudget})
        : null;
    } else {
      formattedPrepaid = prepaid
        ? formatReservedWithUnits(prepaid, billedCategory)
        : null;
      formattedFree = free ? formatReservedWithUnits(free, billedCategory) : null;
      percentUsed = prepaid ? getPercentage(usage, prepaid) : 0;
    }

    paygSpend = isChildProduct
      ? (normalizedMetricHistory.onDemandSpendUsed ?? 0)
      : addOnInfo.dataCategories.reduce((acc, category) => {
          return acc + (subscription.categories[category]?.onDemandSpendUsed ?? 0);
        }, 0);
  } else {
    // convert prepaid amount to the same unit as usage to accurately calculate percent used
    isUnlimited = prepaid === UNLIMITED_RESERVED || !!activeProductTrial;
    const rawPrepaid = isUnlimited
      ? prepaid
      : isByteCategory(billedCategory)
        ? prepaid * GIGABYTE
        : isContinuousProfiling(billedCategory)
          ? prepaid * MILLISECONDS_IN_HOUR
          : prepaid;
    percentUsed = rawPrepaid ? getPercentage(usage, rawPrepaid) : 0;

    formattedUsage = formatUsageWithUnits(usage, billedCategory, {
      isAbbreviated: true,
      useUnitScaling: true,
    });
    formattedPrepaid = formatReservedWithUnits(prepaid, billedCategory, {
      useUnitScaling: true,
      isAbbreviated: true,
    });
    formattedFree = free
      ? formatReservedWithUnits(free, billedCategory, {
          useUnitScaling: true,
          isAbbreviated: true,
        })
      : null;

    paygSpend = normalizedMetricHistory.onDemandSpendUsed ?? 0;
  }
  const bucket = getBucket({
    events: reserved ?? 0, // buckets use the converted unit reserved amount (ie. in GB for byte categories)
    buckets: subscription.planDetails.planCategories[billedCategory],
  });
  otherSpend = calculateSeerUserSpend(normalizedMetricHistory);
  const recurringReservedSpend = isChildProduct ? 0 : (bucket.price ?? 0);
  const additionalSpend = recurringReservedSpend + paygSpend + otherSpend;

  const formattedSoftCapType =
    isChildProduct || !isAddOn ? getSoftCapType(normalizedMetricHistory) : null;
  const formattedDisplayName = formattedSoftCapType
    ? `${displayName} (${formattedSoftCapType})`
    : displayName;

  const isPaygOnly = !isAddOn && supportsPayg(subscription) && reserved === 0;

  const isSelected = selectedProduct === product;

  /**
   * Only show the progress ring if:
   * - the usage is not exceeded
   * - the product is not PAYG only
   * - the product is not a child product (ie. sub-categories of an add-on)
   * - prepaid volume is not unlimited
   * - the product is not an add-on or the product is an add-on with a prepaid volume
   */
  const showProgressRing =
    !usageExceeded &&
    !isPaygOnly &&
    !isChildProduct &&
    !isUnlimited &&
    (!isAddOn || formattedPrepaid);

  const shouldFormatWithDisplayName =
    isContinuousProfiling(billedCategory) || billedCategory === DataCategory.SEER_USER;

  return (
    <Fragment>
      <ProductRow
        data-test-id={`product-row-${product}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        isSelected={isSelected}
        onClick={() => onRowClick(product)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
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
              isChildProduct
                ? '2xl'
                : activeProductTrial || potentialProductTrial
                  ? 'lg'
                  : undefined
            }
            wrap="nowrap"
            height="100%"
            align="center"
          >
            <Text as="span" variant="primary" textWrap="balance">
              {formattedDisplayName}{' '}
            </Text>
          </Flex>
        </td>
        <Fragment>
          <td>
            <Flex align="center" gap="xs" wrap="wrap" height="100%">
              {usageExceeded ? (
                <Container width="18px" height="18px">
                  <IconWarning size="md" variant="danger" />
                </Container>
              ) : showProgressRing ? (
                <Container width="18px" height="18px">
                  <ProgressRing
                    size={18}
                    value={percentUsed}
                    progressColor={
                      !usageExceeded && percentUsed === 100
                        ? theme.tokens.border.danger.vibrant
                        : undefined
                    }
                  />
                </Container>
              ) : null}
              <Text textWrap="balance">
                {isUnlimited ? (
                  <Tag variant="promotion">{t('Unlimited')}</Tag>
                ) : isPaygOnly || isChildProduct || !formattedPrepaid ? (
                  shouldFormatWithDisplayName ? (
                    formatCategoryQuantityWithDisplayName({
                      dataCategory: billedCategory,
                      quantity: usage,
                      formattedQuantity: formattedUsage,
                      subscription,
                      options: {capitalize: false},
                    })
                  ) : (
                    formattedUsage
                  )
                ) : (
                  `${formattedUsage} / ${shouldFormatWithDisplayName ? formatCategoryQuantityWithDisplayName({dataCategory: billedCategory, quantity: prepaid, formattedQuantity: formattedPrepaid, subscription, options: {capitalize: false}}) : formattedPrepaid}`
                )}
              </Text>
              {formattedFree && (
                <Text size="xs">{tct(` ([formattedFree] gifted)`, {formattedFree})}</Text>
              )}
            </Flex>
          </td>
          {activeProductTrial ? (
            <td>
              <Flex justify="end">
                <Tag variant="promotion" icon={<IconClock />}>
                  {tn(
                    '%s day left',
                    '%s days left',
                    -1 * getDaysSinceDate(activeProductTrial.endDate ?? '')
                  )}
                </Tag>
              </Flex>
            </td>
          ) : potentialProductTrial ? (
            <td>
              <Flex justify="end">
                <StartTrialButton
                  organization={organization}
                  source="usage-overview-table"
                  requestData={{
                    productTrial: {
                      category: potentialProductTrial.category,
                      reasonCode: potentialProductTrial.reasonCode,
                    },
                  }}
                  size="xs"
                  icon={<IconPlay />}
                  priority="primary"
                />
              </Flex>
            </td>
          ) : showAdditionalSpendColumn ? (
            <td>
              <Text align="right">{displayPriceWithCents({cents: additionalSpend})}</Text>
            </td>
          ) : null}
        </Fragment>

        {(isSelected || isHovered) && <SelectedPill isSelected={isSelected} />}
      </ProductRow>
      {showPanelInline && isSelected && (
        <Row>
          <MobilePanelContainer>
            <ProductBreakdownPanel
              organization={organization}
              selectedProduct={selectedProduct}
              subscription={subscription}
              usageData={usageData}
              isInline
            />
          </MobilePanelContainer>
        </Row>
      )}
    </Fragment>
  );
}

function DisabledProductRow({
  product,
  onRowClick,
  displayName,
  potentialProductTrial,
  showPanelInline,
  organization,
  selectedProduct,
  usageData,
  subscription,
}: DisabledProductRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedProduct === product;
  return (
    <Fragment>
      <ProductRow
        data-test-id={`product-row-disabled-${product}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        isSelected={isSelected}
        onClick={() => onRowClick(product)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            onRowClick(product);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={t('View %s details', displayName)}
      >
        {potentialProductTrial && (
          <ProductTrialRibbon
            activeProductTrial={null}
            potentialProductTrial={potentialProductTrial}
          />
        )}
        <td>
          <Flex
            paddingLeft={potentialProductTrial ? 'lg' : undefined}
            wrap="nowrap"
            align="center"
            height="100%"
          >
            <Text as="span" variant="muted" textWrap="balance">
              {displayName}{' '}
              <IconContainer>
                <IconLock size="sm" locked variant="muted" />
              </IconContainer>
            </Text>
          </Flex>
        </td>
        {potentialProductTrial && (
          <Fragment>
            <td />
            <td>
              <Flex justify="end">
                <StartTrialButton
                  organization={organization}
                  source="usage-overview-table"
                  requestData={{
                    productTrial: {
                      category: potentialProductTrial.category,
                      reasonCode: potentialProductTrial.reasonCode,
                    },
                  }}
                  size="xs"
                  icon={<IconPlay />}
                  priority="primary"
                />
              </Flex>
            </td>
          </Fragment>
        )}
        {(isSelected || isHovered) && <SelectedPill isSelected={isSelected} />}
      </ProductRow>
      {showPanelInline && isSelected && (
        <Row>
          <MobilePanelContainer>
            <ProductBreakdownPanel
              organization={organization}
              selectedProduct={selectedProduct}
              subscription={subscription}
              usageData={usageData}
              isInline
            />
          </MobilePanelContainer>
        </Row>
      )}
    </Fragment>
  );
}

export default UsageOverviewTableRow;

const Row = styled('tr')`
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  }
`;

const ProductRow = styled(Row)<{isSelected: boolean}>`
  position: relative;
  background: ${p =>
    p.isSelected
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.xl};
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
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
    p.isSelected
      ? p.theme.tokens.graphics.accent.vibrant
      : p.theme.tokens.graphics.neutral.moderate};
`;

const IconContainer = styled('span')`
  display: inline-block;
  vertical-align: middle;
`;
