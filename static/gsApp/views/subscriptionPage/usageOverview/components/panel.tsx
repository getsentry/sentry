import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClock, IconSettings, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {AddOnCategory, OnDemandBudgetMode} from 'getsentry/types';
import {
  displayBudgetName,
  getReservedBudgetCategoryForAddOn,
  normalizeMetricHistory,
  supportsPayg,
} from 'getsentry/utils/billing';
import BilledSeats from 'getsentry/views/subscriptionPage/usageOverview/components/billedSeats';
import {
  DataCategoryUsageBreakdownInfo,
  ReservedBudgetUsageBreakdownInfo,
} from 'getsentry/views/subscriptionPage/usageOverview/components/breakdownInfo';
import UsageCharts from 'getsentry/views/subscriptionPage/usageOverview/components/charts';
import {
  ProductTrialCta,
  SetupCta,
  UpgradeCta,
} from 'getsentry/views/subscriptionPage/usageOverview/components/cta';
import {
  USAGE_OVERVIEW_PANEL_HEADER_HEIGHT,
  USAGE_OVERVIEW_PANEL_REFERRER,
} from 'getsentry/views/subscriptionPage/usageOverview/constants';
import type {BreakdownPanelProps} from 'getsentry/views/subscriptionPage/usageOverview/types';

function PanelHeader({
  panelIsOnlyCta,
  selectedProduct,
  subscription,
  isInline,
  setupRequired,
}: Pick<BreakdownPanelProps, 'selectedProduct' | 'subscription' | 'isInline'> & {
  panelIsOnlyCta: boolean;
  setupRequired: boolean;
}) {
  const {onDemandBudgets: paygBudgets} = subscription;

  const {
    displayName,
    billedCategory,
    isAddOn,
    addOnInfo,
    usageExceeded,
    activeProductTrial,
    productLink,
  } = useProductBillingMetadata(subscription, selectedProduct);

  if (!billedCategory || (isAddOn && !addOnInfo) || panelIsOnlyCta) {
    return null;
  }

  const trialDaysLeft = -1 * getDaysSinceDate(activeProductTrial?.endDate ?? '');

  const hasPaygAvailable =
    supportsPayg(subscription) &&
    subscription.planDetails.onDemandCategories.includes(billedCategory) &&
    ((paygBudgets?.budgetMode === OnDemandBudgetMode.SHARED &&
      paygBudgets.sharedMaxBudget > 0) ||
      (paygBudgets?.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
        (paygBudgets?.budgets[billedCategory] ?? 0) > 0));

  const status = activeProductTrial ? (
    <Tag type="promotion" icon={<IconClock />}>
      {tn('Trial - %s day left', 'Trial - %s days left', trialDaysLeft)}
    </Tag>
  ) : usageExceeded ? (
    <Tag type="error" icon={<IconWarning />}>
      {hasPaygAvailable
        ? tct('[budgetTerm] limit reached', {
            budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
          })
        : t('Usage exceeded')}
    </Tag>
  ) : null;

  if (isInline && !status && !setupRequired) {
    return null;
  }

  return (
    <Flex
      gap="md"
      justify="between"
      align="center"
      borderBottom="primary"
      padding="xl"
      height={USAGE_OVERVIEW_PANEL_HEADER_HEIGHT}
    >
      <Flex gap="md" align="center" height={USAGE_OVERVIEW_PANEL_HEADER_HEIGHT}>
        {!isInline && <Heading as="h3">{displayName}</Heading>}
        {status}
        {setupRequired && (
          <Tag type="warning" icon={<IconWarning />}>
            {t('Action required')}
          </Tag>
        )}
      </Flex>
      {productLink && (
        <LinkButton
          to={`${productLink}?referrer=${USAGE_OVERVIEW_PANEL_REFERRER}`}
          icon={<IconSettings />}
          aria-label={t('Configure %s', displayName)}
          title={tct('Configure [productName]', {productName: displayName})}
          analyticsEventName="Subscription Settings: Product Link Clicked"
          analyticsEventKey="subscription_settings.product_link_clicked"
          analyticsParams={{
            product: selectedProduct,
          }}
        />
      )}
    </Flex>
  );
}

function ProductBreakdownPanel({
  organization,
  selectedProduct,
  subscription,
  usageData,
  isInline,
}: BreakdownPanelProps) {
  const {
    billedCategory,
    isAddOn,
    isEnabled,
    addOnInfo,
    activeProductTrial,
    potentialProductTrial,
  } = useProductBillingMetadata(subscription, selectedProduct);
  // TODO(billing): if we ever show the setup state for other products, this will need refactoring
  // maybe a billing hook for setup checks
  const shouldCheckSetup = selectedProduct === AddOnCategory.SEER && isEnabled;
  const {data: setupCheck, isLoading: setupCheckLoading} = useSeerOnboardingCheck({
    enabled: shouldCheckSetup,
    staleTime: 60_000,
  });
  const setupRequired =
    shouldCheckSetup && !setupCheckLoading && !setupCheck?.isSeerConfigured;

  if (!billedCategory) {
    return null;
  }

  let breakdownInfo = null;

  if (isAddOn) {
    if (!addOnInfo) {
      return null;
    }
    const {apiName} = addOnInfo;
    const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);
    const reservedBudget = subscription.reservedBudgets?.find(
      budget => budget.apiName === reservedBudgetCategory
    );

    if (reservedBudget) {
      breakdownInfo = (
        <ReservedBudgetUsageBreakdownInfo
          subscription={subscription}
          reservedBudget={reservedBudget}
          activeProductTrial={activeProductTrial}
        />
      );
    } else {
      const metricHistory = subscription.categories[billedCategory];
      const normalizedMetricHistory = normalizeMetricHistory(
        billedCategory,
        metricHistory
      );
      breakdownInfo = (
        <DataCategoryUsageBreakdownInfo
          subscription={subscription}
          category={billedCategory}
          metricHistory={normalizedMetricHistory}
          activeProductTrial={activeProductTrial}
        />
      );
    }
  } else {
    const category = selectedProduct as DataCategory;
    const metricHistory = subscription.categories[category];
    const normalizedMetricHistory = normalizeMetricHistory(category, metricHistory);

    breakdownInfo = (
      <DataCategoryUsageBreakdownInfo
        subscription={subscription}
        category={category}
        metricHistory={normalizedMetricHistory}
        activeProductTrial={activeProductTrial}
      />
    );
  }

  const shouldShowUpgradeCta = !potentialProductTrial && !isEnabled;

  return (
    <Container
      height={isEnabled && !setupRequired ? undefined : '100%'}
      border={isInline ? undefined : 'primary'}
      radius={isInline ? undefined : 'md'}
      style={
        isInline
          ? {
              gridColumn: '1 / -1',
            }
          : undefined
      }
    >
      <PanelHeader
        selectedProduct={selectedProduct}
        subscription={subscription}
        isInline={isInline}
        panelIsOnlyCta={!isEnabled}
        setupRequired={setupRequired}
      />
      {setupCheckLoading ? (
        <LoadingIndicator />
      ) : setupRequired ? (
        <SetupCta organization={organization} selectedProduct={selectedProduct} />
      ) : (
        <Fragment>
          {potentialProductTrial && (
            <ProductTrialCta
              organization={organization}
              subscription={subscription}
              selectedProduct={selectedProduct}
              isBanner={isEnabled}
              potentialProductTrial={potentialProductTrial}
            />
          )}
          {isEnabled && (
            <Fragment>
              {breakdownInfo}
              <UsageCharts
                selectedProduct={selectedProduct}
                usageData={usageData}
                subscription={subscription}
                organization={organization}
              />
            </Fragment>
          )}
          {shouldShowUpgradeCta && (
            <UpgradeCta
              organization={organization}
              subscription={subscription}
              selectedProduct={selectedProduct}
            />
          )}
          <BilledSeats
            organization={organization}
            selectedProduct={selectedProduct}
            subscription={subscription}
          />
        </Fragment>
      )}
    </Container>
  );
}

export default ProductBreakdownPanel;
