import {Fragment} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
import type {
  BillingMetricHistory,
  Plan,
  ProductTrial,
  ReservedBudget,
  Subscription,
} from 'getsentry/types';
import {
  checkIsAddOnChildCategory,
  displayBudgetName,
  formatReservedWithUnits,
  getSoftCapType,
  hasPaygBudgetForCategory,
  isTrialPlan,
  supportsPayg,
} from 'getsentry/utils/billing';
import {calculateSeerUserSpend} from 'getsentry/utils/dataCategory';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

interface BaseProps {
  activeProductTrial: ProductTrial | null;
  subscription: Subscription;
}

interface UsageBreakdownInfoProps extends BaseProps {
  formattedAdditionalReserved: React.ReactNode | null;
  formattedGifted: React.ReactNode | null;
  formattedPlatformReserved: React.ReactNode | null;
  formattedSoftCapType: React.ReactNode | null;
  paygCategoryBudget: number | null;
  paygSpend: number;
  plan: Plan;
  platformReservedField: React.ReactNode;
  productCanUsePayg: boolean;
  recurringReservedSpend: number | null;
  formattedOtherSpend?: React.ReactNode;
}

interface DataCategoryUsageBreakdownInfoProps extends BaseProps {
  category: DataCategory;
  metricHistory: BillingMetricHistory;
}

interface ReservedBudgetUsageBreakdownInfoProps extends BaseProps {
  reservedBudget: ReservedBudget;
}

function UsageBreakdownField({
  field,
  value,
  help,
}: {
  field: React.ReactNode;
  value: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <Flex direction="column" gap="sm">
      <Flex gap="sm">
        <Text variant="muted" bold uppercase size="sm">
          {field}
        </Text>
        {help && <QuestionTooltip title={help} size="xs" />}
      </Flex>
      <Text size="lg">{value}</Text>
    </Flex>
  );
}

function UsageBreakdownInfo({
  subscription,
  plan,
  platformReservedField,
  formattedPlatformReserved,
  formattedAdditionalReserved,
  formattedGifted,
  paygSpend,
  paygCategoryBudget,
  recurringReservedSpend,
  productCanUsePayg,
  activeProductTrial,
  formattedSoftCapType,
  formattedOtherSpend,
}: UsageBreakdownInfoProps) {
  const canUsePayg = productCanUsePayg && supportsPayg(subscription);
  const shouldShowIncludedVolume =
    !!activeProductTrial ||
    !!formattedPlatformReserved ||
    !!formattedAdditionalReserved ||
    !!formattedGifted;
  const shouldShowReservedSpend =
    defined(recurringReservedSpend) &&
    recurringReservedSpend > 0 &&
    subscription.canSelfServe;
  const shouldShowAdditionalSpend =
    shouldShowReservedSpend ||
    canUsePayg ||
    defined(formattedSoftCapType) ||
    formattedOtherSpend;

  if (!shouldShowIncludedVolume && !shouldShowAdditionalSpend) {
    return null;
  }

  const interval = plan.contractInterval === 'monthly' ? t('month') : t('year');

  return (
    <Grid columns="repeat(2, 1fr)" gap="md lg" padding="xl">
      {shouldShowIncludedVolume && (
        <Flex direction="column" gap="lg">
          <Text bold>{t('Included volume')}</Text>
          {activeProductTrial && (
            <UsageBreakdownField field={t('Trial')} value={t('Unlimited')} />
          )}
          {formattedPlatformReserved && (
            <UsageBreakdownField
              field={platformReservedField}
              value={formattedPlatformReserved}
            />
          )}
          {formattedAdditionalReserved && (
            <UsageBreakdownField
              field={t('Additional reserved')}
              value={formattedAdditionalReserved}
            />
          )}
          {formattedGifted && (
            <UsageBreakdownField field={t('Gifted')} value={formattedGifted} />
          )}
        </Flex>
      )}
      {shouldShowAdditionalSpend && (
        <Flex direction="column" gap="lg">
          <Text bold>{t('Additional spend')}</Text>
          {formattedSoftCapType && (
            <UsageBreakdownField
              field={t('Soft cap type')}
              value={formattedSoftCapType}
            />
          )}
          {canUsePayg && (
            <UsageBreakdownField
              field={displayBudgetName(plan, {title: true})}
              value={
                <Fragment>
                  {displayPriceWithCents({cents: paygSpend})}
                  {!!paygCategoryBudget && (
                    <Fragment>
                      {' / '}
                      <Text variant="muted">
                        {displayPriceWithCents({cents: paygCategoryBudget})}
                      </Text>
                    </Fragment>
                  )}
                </Fragment>
              }
              help={tct(
                "The amount of [budgetTerm] you've used so far on this product in the current month.",
                {
                  budgetTerm: displayBudgetName(plan),
                }
              )}
            />
          )}
          {shouldShowReservedSpend && (
            <UsageBreakdownField
              field={t('Reserved spend')}
              value={`${displayPriceWithCents({cents: recurringReservedSpend})} / ${interval}`}
              help={t(
                'The amount you spend on additional reserved volume for this product per billing cycle.'
              )}
            />
          )}
          {formattedOtherSpend}
        </Flex>
      )}
    </Grid>
  );
}

function DataCategoryUsageBreakdownInfo({
  subscription,
  category,
  metricHistory,
  activeProductTrial,
}: DataCategoryUsageBreakdownInfoProps) {
  const {planDetails: plan} = subscription;
  const productCanUsePayg =
    plan.onDemandCategories.includes(category) &&
    hasPaygBudgetForCategory(subscription, category);
  const reserved = metricHistory.reserved ?? 0;
  const platformReserved = subscription.canSelfServe
    ? (plan.planCategories[category]?.find(
        bucket => bucket.price === 0 && bucket.events >= 0
      )?.events ?? 0)
    : reserved;
  const platformReservedField = tct('[planName] plan', {planName: plan.name});

  const additionalReserved = Math.max(0, reserved - platformReserved);
  const shouldShowAdditionalReserved = additionalReserved > 0;
  const formattedAdditionalReserved = shouldShowAdditionalReserved
    ? formatReservedWithUnits(additionalReserved, category)
    : null;
  const formattedPlatformReserved =
    reserved > 0
      ? formatReservedWithUnits(
          shouldShowAdditionalReserved ? platformReserved : reserved,
          category
        )
      : reserved === UNLIMITED_RESERVED
        ? t('Unlimited')
        : null;

  const gifted = metricHistory.free ?? 0;
  const formattedGifted = gifted ? formatReservedWithUnits(gifted, category) : null;

  const paygSpend = metricHistory.onDemandSpendUsed ?? 0;
  const paygCategoryBudget = metricHistory.onDemandBudget ?? 0;

  const isAddOnChildCategory = checkIsAddOnChildCategory(subscription, category, true);
  const recurringReservedSpend = isAddOnChildCategory
    ? null
    : (plan.planCategories[category]?.find(bucket => bucket.events === reserved)?.price ??
      0);

  const otherSpend = calculateSeerUserSpend(metricHistory);
  const formattedOtherSpend =
    otherSpend > 0 ? (
      <UsageBreakdownField
        field={t('Active contributors spend')}
        value={displayPriceWithCents({
          cents: otherSpend,
        })}
        help={t(
          'An active contributor is anyone who opens 2 or more PRs in a connected GitHub repository. Count resets each month.'
        )}
      />
    ) : undefined;

  return (
    <UsageBreakdownInfo
      subscription={subscription}
      plan={plan}
      platformReservedField={platformReservedField}
      formattedPlatformReserved={formattedPlatformReserved}
      formattedAdditionalReserved={formattedAdditionalReserved}
      formattedGifted={formattedGifted}
      paygSpend={paygSpend}
      paygCategoryBudget={paygCategoryBudget}
      recurringReservedSpend={recurringReservedSpend}
      productCanUsePayg={productCanUsePayg}
      activeProductTrial={activeProductTrial}
      formattedSoftCapType={getSoftCapType(metricHistory)}
      formattedOtherSpend={formattedOtherSpend}
    />
  );
}

function ReservedBudgetUsageBreakdownInfo({
  subscription,
  reservedBudget,
  activeProductTrial,
}: ReservedBudgetUsageBreakdownInfoProps) {
  const {planDetails: plan, categories: metricHistories} = subscription;
  const productCanUsePayg = reservedBudget.dataCategories.every(
    category =>
      plan.onDemandCategories.includes(category) &&
      hasPaygBudgetForCategory(subscription, category)
  );
  const onTrialOrSponsored = isTrialPlan(subscription.plan) || subscription.isSponsored;

  const platformReservedField = onTrialOrSponsored
    ? tct('[planName] plan', {planName: plan.name})
    : tct('[productName] monthly credits', {
        productName: toTitleCase(reservedBudget.productName, {
          allowInnerUpperCase: true,
        }),
      });
  const formattedPlatformReserved = displayPriceWithCents({
    cents: reservedBudget.reservedBudget,
  });

  const formattedAdditionalReserved = null;
  const formattedGifted =
    reservedBudget.freeBudget > 0
      ? displayPriceWithCents({cents: reservedBudget.freeBudget})
      : null;
  const paygSpend = reservedBudget.dataCategories.reduce((acc, category) => {
    return acc + (metricHistories[category]?.onDemandSpendUsed ?? 0);
  }, 0);

  const billedCategory = reservedBudget.dataCategories[0]!;
  const metricHistory = subscription.categories[billedCategory];
  if (!metricHistory) {
    // we don't normalize metric history here because there should always be a metric history
    // for a reserved budget, otherwise there is no way to indicate that that category should
    // be tallied as a budget (reserved = RESERVED_BUDGET_QUOTA)
    return null;
  }
  const recurringReservedSpend =
    plan.planCategories[billedCategory]?.find(
      bucket => bucket.events === metricHistory.reserved
    )?.price ?? 0;

  return (
    <UsageBreakdownInfo
      subscription={subscription}
      plan={plan}
      platformReservedField={platformReservedField}
      formattedPlatformReserved={formattedPlatformReserved}
      formattedAdditionalReserved={formattedAdditionalReserved}
      formattedGifted={formattedGifted}
      paygSpend={paygSpend}
      paygCategoryBudget={null}
      recurringReservedSpend={recurringReservedSpend}
      productCanUsePayg={productCanUsePayg}
      activeProductTrial={activeProductTrial}
      formattedSoftCapType={null} // Reserved budgets don't have soft caps, the individual categories in the budget may
    />
  );
}

export {DataCategoryUsageBreakdownInfo, ReservedBudgetUsageBreakdownInfo};
