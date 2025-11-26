import {useState} from 'react';

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
import {CHART_OPTIONS_DATA_TRANSFORM} from 'sentry/views/organizationStats/usageChart';

import StartTrialButton from 'getsentry/components/startTrialButton';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {
  AddOnCategory,
  OnDemandBudgetMode,
  type CustomerUsage,
  type Subscription,
} from 'getsentry/types';
import {
  addBillingStatTotals,
  displayBudgetName,
  getActiveProductTrial,
  getPotentialProductTrial,
  getReservedBudgetCategoryForAddOn,
  isAm2Plan,
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
} from 'getsentry/views/subscriptionPage/usageBreakdownInfo';
import {EMPTY_STAT_TOTAL} from 'getsentry/views/subscriptionPage/usageTotals';
import UsageTotalsTable from 'getsentry/views/subscriptionPage/usageTotalsTable';

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
  const [trialButtonBusy, setTrialButtonBusy] = useState(false);
  const location = useLocation();
  const transform = selectedTransform(location);
  const navigate = useNavigate();

  if (Object.values(AddOnCategory).includes(selectedProduct as AddOnCategory)) {
    const addOnInfo = subscription.addOns?.[selectedProduct as AddOnCategory];
    if (!addOnInfo) {
      return null;
    }
    const {productName, apiName, dataCategories} = addOnInfo;
    const displayName = toTitleCase(productName, {allowInnerUpperCase: true});

    const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);
    const reservedBudget = subscription.reservedBudgets?.find(
      budget => budget.apiName === reservedBudgetCategory
    );
    const billedCategory = reservedBudget
      ? dataCategories.find(category =>
          subscription.planDetails.planCategories[category]?.find(
            bucket => bucket.events === RESERVED_BUDGET_QUOTA
          )
        )!
      : dataCategories[0]!;
    const usageExceeded = subscription.categories[billedCategory]?.usageExceeded ?? false;

    const {onDemandBudgets: paygBudgets} = subscription;
    const hasPayg =
      supportsPayg(subscription) &&
      subscription.planDetails.onDemandCategories.includes(billedCategory) &&
      ((paygBudgets?.budgetMode === OnDemandBudgetMode.SHARED &&
        paygBudgets.sharedMaxBudget > 0) ||
        (paygBudgets?.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
          (paygBudgets?.budgets[billedCategory] ?? 0) > 0));

    const activeProductTrial = getActiveProductTrial(
      subscription.productTrials ?? null,
      billedCategory
    );
    const potentialProductTrial = getPotentialProductTrial(
      subscription.productTrials ?? null,
      billedCategory
    );
    const trialDaysLeft = -1 * getDaysSinceDate(activeProductTrial?.endDate ?? '');

    const status = activeProductTrial ? (
      <Tag type="promotion" icon={<IconClock />}>
        {tn('Trial - %s day left', 'Trial - %s days left', trialDaysLeft)}
      </Tag>
    ) : usageExceeded ? (
      <Tag type="error" icon={<IconWarning />}>
        {hasPayg
          ? tct('[budgetTerm] limit reached', {
              budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
            })
          : t('Usage exceeded')}
      </Tag>
    ) : null;

    return (
      <Container background="primary" border="primary" radius="md">
        <Flex gap="md" align="center" borderBottom="primary" padding="xl">
          <Heading as="h3">{displayName}</Heading>
          {status}
        </Flex>
        {potentialProductTrial && (
          <Grid
            background="secondary"
            padding="xl"
            columns={{xs: 'repeat(2, 1fr)', lg: 'max-content auto'}}
            gap="3xl"
            borderBottom="primary"
          >
            <Flex direction="column" gap="sm">
              <Text bold textWrap="balance">
                {tct('Try unlimited [productName], free for 14 days', {productName})}
              </Text>
              <Text variant="muted" size="sm" textWrap="balance">
                {t(
                  'Trial starts immediately, no usage will be billed during this period.'
                )}
              </Text>
            </Flex>
            <Flex direction="column" gap="lg">
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
              <LinkButton
                icon={<IconOpen />}
                priority="link"
                size="sm"
                href="https://docs.sentry.io/pricing/#product-trials"
              >
                {t('Find out more')}
              </LinkButton>
            </Flex>
          </Grid>
        )}
        {reservedBudget && reservedBudget.reservedBudget > 0 && (
          <ReservedBudgetUsageBreakdownInfo
            subscription={subscription}
            reservedBudget={reservedBudget}
          />
        )}
        {/* {tallyType === 'usage' && (
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
        )} */}
      </Container>
    );
  }

  const category = selectedProduct as DataCategory;

  const displayName = getPlanCategoryName({
    plan: subscription.planDetails,
    category,
    title: true,
  });
  const metricHistory = subscription.categories[category];
  const categoryInfo = getCategoryInfoFromPlural(category);
  if (!metricHistory || !categoryInfo) {
    return null;
  }
  const {productName, tallyType} = categoryInfo;
  const {usageExceeded, usage: billedUsage} = metricHistory;
  const {onDemandBudgets: paygBudgets} = subscription;
  const hasPayg =
    supportsPayg(subscription) &&
    ((paygBudgets?.budgetMode === OnDemandBudgetMode.SHARED &&
      paygBudgets.sharedMaxBudget > 0) ||
      (paygBudgets?.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
        (paygBudgets?.budgets[category] ?? 0) > 0));

  const activeProductTrial = getActiveProductTrial(
    subscription.productTrials ?? null,
    category
  );
  const potentialProductTrial = getPotentialProductTrial(
    subscription.productTrials ?? null,
    category
  );
  const trialDaysLeft = -1 * getDaysSinceDate(activeProductTrial?.endDate ?? '');

  const status = activeProductTrial ? (
    <Tag type="promotion" icon={<IconClock />}>
      {tn('Trial - %s day left', 'Trial - %s days left', trialDaysLeft)}
    </Tag>
  ) : usageExceeded ? (
    <Tag type="error" icon={<IconWarning />}>
      {hasPayg
        ? tct('[budgetTerm] limit reached', {
            budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
          })
        : t('Usage exceeded')}
    </Tag>
  ) : null;

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
    if (tallyType === 'seat') {
      return null;
    }
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
    <Container background="primary" border="primary" radius="md">
      <Flex gap="md" align="center" borderBottom="primary" padding="xl">
        <Heading as="h3">{displayName}</Heading>
        {status}
      </Flex>
      {potentialProductTrial && (
        <Grid
          background="secondary"
          padding="xl"
          columns={{xs: 'repeat(2, 1fr)', lg: 'max-content auto'}}
          gap="3xl"
          borderBottom="primary"
        >
          <Flex direction="column" gap="sm">
            <Text bold textWrap="balance">
              {tct('Try unlimited [productName], free for 14 days', {productName})}
            </Text>
            <Text variant="muted" size="sm" textWrap="balance">
              {t('Trial starts immediately, no usage will be billed during this period.')}
            </Text>
          </Flex>
          <Flex direction="column" gap="lg">
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
            <LinkButton
              icon={<IconOpen />}
              priority="link"
              size="sm"
              href="https://docs.sentry.io/pricing/#product-trials"
            >
              {t('Find out more')}
            </LinkButton>
          </Flex>
        </Grid>
      )}
      <DataCategoryUsageBreakdownInfo
        plan={subscription.planDetails}
        category={category}
        metricHistory={metricHistory}
      />
      {tallyType === 'usage' && (
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
      )}
    </Container>
  );
}

export default ProductBreakdownPanel;
