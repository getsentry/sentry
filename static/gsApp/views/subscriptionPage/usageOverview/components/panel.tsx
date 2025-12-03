import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {IconClock, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {AddOnCategory, OnDemandBudgetMode} from 'getsentry/types';
import {
  displayBudgetName,
  getReservedBudgetCategoryForAddOn,
  supportsPayg,
} from 'getsentry/utils/billing';
import {
  DataCategoryUsageBreakdownInfo,
  ReservedBudgetUsageBreakdownInfo,
} from 'getsentry/views/subscriptionPage/usageOverview/components/breakdownInfo';
import UsageCharts from 'getsentry/views/subscriptionPage/usageOverview/components/charts';
import {
  ProductTrialCta,
  UpgradeCta,
} from 'getsentry/views/subscriptionPage/usageOverview/components/upgradeOrTrialCta';
import type {BreakdownPanelProps} from 'getsentry/views/subscriptionPage/usageOverview/types';

function PanelHeader({
  selectedProduct,
  subscription,
}: Pick<BreakdownPanelProps, 'selectedProduct' | 'subscription'>) {
  const {onDemandBudgets: paygBudgets} = subscription;

  const {
    displayName,
    billedCategory,
    isAddOn,
    addOnInfo,
    usageExceeded,
    activeProductTrial,
  } = useProductBillingMetadata(subscription, selectedProduct);

  if (
    // special case for seer add-on
    selectedProduct === AddOnCategory.SEER ||
    !billedCategory ||
    (isAddOn && !addOnInfo)
  ) {
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

  return (
    <Flex gap="md" align="center" borderBottom="primary" padding="xl">
      <Heading as="h3">{displayName}</Heading>
      {status}
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
    }
  } else {
    const category = selectedProduct as DataCategory;
    const metricHistory = subscription.categories[category];
    if (!metricHistory) {
      return null;
    }

    breakdownInfo = (
      <DataCategoryUsageBreakdownInfo
        subscription={subscription}
        category={category}
        metricHistory={metricHistory}
        activeProductTrial={activeProductTrial}
      />
    );
  }

  const isEmpty = !potentialProductTrial && !isEnabled;

  return (
    <Container
      background="primary"
      border={isInline ? undefined : 'primary'}
      borderBottom={isInline ? 'primary' : undefined}
      radius={isInline ? undefined : 'md'}
      style={
        isInline
          ? {
              gridColumn: '1 / -1',
            }
          : undefined
      }
    >
      <PanelHeader selectedProduct={selectedProduct} subscription={subscription} />
      {potentialProductTrial && (
        <ProductTrialCta
          organization={organization}
          subscription={subscription}
          selectedProduct={selectedProduct}
          showBottomBorder={isEnabled}
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
      {isEmpty && <UpgradeCta organization={organization} subscription={subscription} />}
    </Container>
  );
}

export default ProductBreakdownPanel;
