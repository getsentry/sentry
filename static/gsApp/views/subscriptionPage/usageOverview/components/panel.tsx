import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {IconClock, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

import {AddOnCategory, OnDemandBudgetMode} from 'getsentry/types';
import {
  checkIsAddOn,
  displayBudgetName,
  getActiveProductTrial,
  getBilledCategory,
  getPotentialProductTrial,
  getReservedBudgetCategoryForAddOn,
  productIsEnabled,
  supportsPayg,
} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import {
  DataCategoryUsageBreakdownInfo,
  ReservedBudgetUsageBreakdownInfo,
} from 'getsentry/views/subscriptionPage/usageOverview/components/breakdownInfo';
import UsageCharts from 'getsentry/views/subscriptionPage/usageOverview/components/charts';
import {
  ProductTrialCta,
  UpgradeCta,
} from 'getsentry/views/subscriptionPage/usageOverview/components/upgradeOrTrialCta';
import type {BreakdownPanelProps} from 'getsentry/views/subscriptionPage/usageOverview/type';

function PanelHeader({
  selectedProduct,
  subscription,
}: Pick<BreakdownPanelProps, 'selectedProduct' | 'subscription'>) {
  const {onDemandBudgets: paygBudgets} = subscription;
  let displayName = '';
  let billedCategory = null;

  if (selectedProduct === AddOnCategory.SEER) {
    return null; // special case for seer add-on
  }

  const isAddOn = checkIsAddOn(selectedProduct);

  if (isAddOn) {
    const category = selectedProduct as AddOnCategory;
    const addOnInfo = subscription.addOns?.[category];
    if (!addOnInfo) {
      return null;
    }
    const {productName} = addOnInfo;
    displayName = toTitleCase(productName, {allowInnerUpperCase: true});
    billedCategory = getBilledCategory(subscription, selectedProduct);
  } else {
    const category = selectedProduct as DataCategory;
    displayName = getPlanCategoryName({
      plan: subscription.planDetails,
      category,
      title: true,
    });
    billedCategory = category;
  }

  if (!billedCategory) {
    return null;
  }

  const activeProductTrial = getActiveProductTrial(
    subscription.productTrials ?? null,
    billedCategory
  );
  const trialDaysLeft = -1 * getDaysSinceDate(activeProductTrial?.endDate ?? '');

  const usageExceeded = subscription.categories[billedCategory]?.usageExceeded ?? false;

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
}: BreakdownPanelProps) {
  const {layout: navLayout} = useNavContext();
  const isMobile = navLayout === NavLayout.MOBILE;

  const isAddOn = Object.values(AddOnCategory).includes(selectedProduct as AddOnCategory);
  let breakdownInfo = null;
  const billedCategory = getBilledCategory(subscription, selectedProduct);
  if (!billedCategory) {
    return null;
  }
  const isEnabled = productIsEnabled(subscription, selectedProduct);
  const activeProductTrial = getActiveProductTrial(
    subscription.productTrials ?? null,
    billedCategory
  );
  const potentialProductTrial = getPotentialProductTrial(
    subscription.productTrials ?? null,
    billedCategory
  );

  if (isAddOn) {
    const addOnInfo = subscription.addOns?.[selectedProduct as AddOnCategory];
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
      border={isMobile ? undefined : 'primary'}
      borderBottom={isMobile ? 'primary' : undefined}
      radius={isMobile ? undefined : 'md'}
      style={
        isMobile
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
