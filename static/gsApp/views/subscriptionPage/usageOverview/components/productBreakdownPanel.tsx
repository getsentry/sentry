import {Fragment, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {ChartControls, InlineContainer} from 'sentry/components/charts/styles';
import {IconClock, IconLightning, IconOpen, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';
import {CHART_OPTIONS_DATA_TRANSFORM} from 'sentry/views/organizationStats/usageChart';

import StartTrialButton from 'getsentry/components/startTrialButton';
import {
  AddOnCategory,
  BillingType,
  OnDemandBudgetMode,
  type CustomerUsage,
  type ProductTrial,
  type Subscription,
} from 'getsentry/types';
import {
  addBillingStatTotals,
  checkIsAddOn,
  displayBudgetName,
  getActiveProductTrial,
  getBilledCategory,
  getPotentialProductTrial,
  getReservedBudgetCategoryForAddOn,
  isAm2Plan,
  productIsEnabled,
  supportsPayg,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getChunkCategoryFromDuration,
  getPlanCategoryName,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {
  ProductUsageChart,
  selectedTransform,
} from 'getsentry/views/subscriptionPage/reservedUsageChart';
import {
  DataCategoryUsageBreakdownInfo,
  ReservedBudgetUsageBreakdownInfo,
} from 'getsentry/views/subscriptionPage/usageOverview/components/usageBreakdownInfo';
import {EMPTY_STAT_TOTAL} from 'getsentry/views/subscriptionPage/usageTotals';
import UsageTotalsTable from 'getsentry/views/subscriptionPage/usageTotalsTable';

function PanelHeader({
  selectedProduct,
  subscription,
}: {
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
}) {
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

function Cta({
  title,
  subtitle,
  buttons,
  hasContentBelow,
}: {
  hasContentBelow: boolean;
  subtitle: React.ReactNode;
  title: React.ReactNode;
  buttons?: React.ReactNode;
}) {
  return (
    <Grid
      background="secondary"
      padding="xl"
      columns={
        buttons ? {'2xs': 'auto', xs: 'repeat(2, 1fr)', lg: 'fit-content auto'} : '1fr'
      }
      gap="3xl"
      borderBottom={hasContentBelow ? 'primary' : undefined}
      radius={hasContentBelow ? undefined : '0 0 md md'}
    >
      <Flex direction="column" gap="sm">
        <Text bold textWrap="balance">
          {title}
        </Text>
        <Text variant="muted" size="sm" textWrap="balance">
          {subtitle}
        </Text>
      </Flex>
      {buttons && (
        <Flex direction="column" gap="lg">
          {buttons}
        </Flex>
      )}
    </Grid>
  );
}

function FindOutMoreButton({
  href,
  to,
}:
  | {
      href: string;
      to?: never;
    }
  | {
      to: string;
      href?: never;
    }) {
  return (
    <LinkButton icon={<IconOpen />} priority="link" size="sm" href={href} to={to ?? ''}>
      {t('Find out more')}
    </LinkButton>
  );
}

function ProductTrialCta({
  organization,
  subscription,
  selectedProduct,
  showBottomBorder,
  potentialProductTrial,
}: {
  organization: Organization;
  potentialProductTrial: ProductTrial;
  selectedProduct: DataCategory | AddOnCategory;
  showBottomBorder: boolean;
  subscription: Subscription;
}) {
  const [trialButtonBusy, setTrialButtonBusy] = useState(false);
  const billedCategory = getBilledCategory(subscription, selectedProduct);
  if (!billedCategory) {
    return null;
  }

  const isAddOn = checkIsAddOn(selectedProduct);
  const addOnInfo = isAddOn
    ? subscription.addOns?.[selectedProduct as AddOnCategory]
    : null;
  if (isAddOn && !addOnInfo) {
    return null;
  }

  const productName = isAddOn
    ? toTitleCase(addOnInfo!.productName, {allowInnerUpperCase: true})
    : getPlanCategoryName({
        plan: subscription.planDetails,
        category: billedCategory,
        title: true,
      });

  return (
    <Cta
      title={tct('Try unlimited [productName], free for 14 days', {productName})}
      subtitle={t(
        'Trial starts immediately, no usage will be billed during this period.'
      )}
      buttons={
        <Fragment>
          <StartTrialButton
            size="md"
            icon={<IconLightning />}
            organization={organization}
            source="usage-overview"
            requestData={{
              productTrial: {
                category: potentialProductTrial.category,
                reasonCode: potentialProductTrial.reasonCode,
              },
            }}
            priority="primary"
            handleClick={() => setTrialButtonBusy(true)}
            onTrialStarted={() => setTrialButtonBusy(true)}
            onTrialFailed={() => setTrialButtonBusy(false)}
            busy={trialButtonBusy}
            disabled={trialButtonBusy}
          >
            {t('Activate free trial')}
          </StartTrialButton>
          <FindOutMoreButton href="https://docs.sentry.io/pricing/#product-trials" />
        </Fragment>
      }
      hasContentBelow={showBottomBorder}
    />
  );
}

function UpgradeCta({
  organization,
  subscription,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const isSalesAccount =
    // Invoiced subscriptions are managed by sales
    subscription.type === BillingType.INVOICED ||
    // Custom-priced subscriptions (price > 0) are managed by sales
    (subscription.customPrice !== null && subscription.customPrice > 0);

  return (
    <Cta
      title={t('Upgrade required')}
      subtitle={tct('You currently do not have access to this feature. [action]', {
        action: subscription.canSelfServe
          ? t('Upgrade your plan to enable it.')
          : isSalesAccount
            ? tct('Contact us at [mailto:sales@sentry.io] to upgrade.', {
                mailto: <a href="mailto:sales@sentry.io" />,
              })
            : tct('Contact us at [mailto:support@sentry.io] to upgrade.', {
                mailto: <a href="mailto:support@sentry.io" />,
              }),
      })}
      buttons={
        subscription.canSelfServe ? (
          <Fragment>
            <LinkButton
              priority="primary"
              href={`/checkout/${organization.slug}/?referrer=product-breakdown-panel`}
            >
              {t('Upgrade now')}
            </LinkButton>
            <FindOutMoreButton href="https://docs.sentry.io/pricing/#pricing-by-product-and-data-category" />
          </Fragment>
        ) : undefined
      }
      hasContentBelow={false}
    />
  );
}

function UsageCharts({
  selectedProduct,
  usageData,
  subscription,
  organization,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
  usageData: CustomerUsage;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const transform = selectedTransform(location);
  if (checkIsAddOn(selectedProduct)) {
    return null;
  }

  const category = selectedProduct as DataCategory;
  const metricHistory = subscription.categories[category];
  const categoryInfo = getCategoryInfoFromPlural(category);

  if (!metricHistory || !categoryInfo) {
    return null;
  }

  const {tallyType} = categoryInfo;
  if (tallyType === 'seat') {
    return null;
  }

  const {usage: billedUsage} = metricHistory;
  const stats = usageData.stats[category] ?? [];
  const eventTotals = usageData.eventTotals?.[category] ?? {};
  const totals = usageData.totals[category] ?? EMPTY_STAT_TOTAL;
  const usageStats = {
    [category]: stats,
  };

  const adjustedTotals = isContinuousProfiling(category)
    ? {
        ...addBillingStatTotals(totals, [
          eventTotals[getChunkCategoryFromDuration(category)] ?? EMPTY_STAT_TOTAL,
          !isAm2Plan(subscription.plan) &&
          selectedProduct === DataCategory.PROFILE_DURATION
            ? (eventTotals[DataCategory.PROFILES] ?? EMPTY_STAT_TOTAL)
            : EMPTY_STAT_TOTAL,
        ]),
        accepted: billedUsage,
      }
    : {...totals, accepted: billedUsage};

  const renderFooter = () => {
    return (
      <ChartControls>
        <InlineContainer>
          <OptionSelector
            title={t('Type')}
            selected={transform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) => {
              trackGetsentryAnalytics(
                'subscription_page.usage_overview.transform_changed',
                {
                  organization,
                  subscription,
                  transform: val,
                }
              );
              navigate({
                pathname: location.pathname,
                query: {...location.query, transform: val},
              });
            }}
          />
        </InlineContainer>
      </ChartControls>
    );
  };

  return (
    <Container padding="xl">
      <ProductUsageChart
        useDisplayModeTitle={false}
        usageStats={usageStats}
        shouldDisplayBudgetStats={false}
        reservedBudgetCategoryInfo={{}}
        displayMode="usage"
        subscription={subscription}
        category={category}
        transform={transform}
        usagePeriodStart={usageData.periodStart}
        usagePeriodEnd={usageData.periodEnd}
        footer={renderFooter()}
      />
      <UsageTotalsTable
        category={category}
        subscription={subscription}
        totals={adjustedTotals}
      />
    </Container>
  );
}

function ProductBreakdownPanel({
  organization,
  selectedProduct,
  subscription,
  usageData,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
  usageData: CustomerUsage;
}) {
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
