import {Fragment} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {UNLIMITED, UNLIMITED_RESERVED} from 'getsentry/constants';
import type {
  BillingMetricHistory,
  Plan,
  ProductTrial,
  ReservedBudget,
  Subscription,
} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  getSoftCapType,
  isTrialPlan,
  supportsPayg,
} from 'getsentry/utils/billing';
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
}: UsageBreakdownInfoProps) {
  const canUsePayg = productCanUsePayg && supportsPayg(subscription);
  const shouldShowIncludedVolume =
    !!activeProductTrial ||
    !!formattedPlatformReserved ||
    !!formattedAdditionalReserved ||
    !!formattedGifted;
  const shouldShowReservedSpend =
    defined(recurringReservedSpend) && subscription.canSelfServe;
  const shouldShowAdditionalSpend =
    shouldShowReservedSpend || canUsePayg || defined(formattedSoftCapType);

  if (!shouldShowIncludedVolume && !shouldShowAdditionalSpend) {
    return null;
  }

  return (
    <Grid columns="repeat(2, 1fr)" gap="md lg" padding="xl">
      {shouldShowIncludedVolume && (
        <Flex direction="column" gap="lg">
          <Text bold>{t('Included volume')}</Text>
          {activeProductTrial && (
            <UsageBreakdownField field={t('Trial')} value={UNLIMITED} />
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
              value={displayPriceWithCents({cents: recurringReservedSpend})}
              help={t(
                'The amount you spend on additional reserved volume for this product per billing cycle.'
              )}
            />
          )}
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
  const productCanUsePayg = plan.onDemandCategories.includes(category);
  const platformReserved =
    plan.planCategories[category]?.find(
      bucket => bucket.price === 0 && bucket.events >= 0
    )?.events ?? 0;
  const platformReservedField = tct('[planName] plan', {planName: plan.name});
  const reserved = metricHistory.reserved ?? 0;
  const isUnlimited = reserved === UNLIMITED_RESERVED;

  const addOnDataCategories = Object.values(plan.addOnCategories).flatMap(
    addOn => addOn.dataCategories
  );
  const isAddOnChildCategory = addOnDataCategories.includes(category) && !isUnlimited;

  const shouldShowAdditionalReserved =
    !isAddOnChildCategory && !isUnlimited && subscription.canSelfServe;
  const formattedPlatformReserved = isAddOnChildCategory
    ? null
    : formatReservedWithUnits(
        shouldShowAdditionalReserved ? platformReserved : reserved,
        category
      );
  const additionalReserved = Math.max(0, reserved - platformReserved);
  const formattedAdditionalReserved = shouldShowAdditionalReserved
    ? formatReservedWithUnits(additionalReserved, category)
    : null;

  const gifted = metricHistory.free ?? 0;
  const formattedGifted = isAddOnChildCategory
    ? null
    : formatReservedWithUnits(gifted, category);

  const paygSpend = metricHistory.onDemandSpendUsed ?? 0;
  const paygCategoryBudget = metricHistory.onDemandBudget ?? 0;

  const recurringReservedSpend = isAddOnChildCategory
    ? null
    : (plan.planCategories[category]?.find(bucket => bucket.events === reserved)?.price ??
      0);

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
    />
  );
}

function ReservedBudgetUsageBreakdownInfo({
  subscription,
  reservedBudget,
  activeProductTrial,
}: ReservedBudgetUsageBreakdownInfoProps) {
  const {planDetails: plan, categories: metricHistories} = subscription;
  const productCanUsePayg = reservedBudget.dataCategories.every(category =>
    plan.onDemandCategories.includes(category)
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
  const formattedGifted = displayPriceWithCents({cents: reservedBudget.freeBudget});
  const paygSpend = reservedBudget.dataCategories.reduce((acc, category) => {
    return acc + (metricHistories[category]?.onDemandSpendUsed ?? 0);
  }, 0);

  const billedCategory = reservedBudget.dataCategories[0]!;
  const metricHistory = subscription.categories[billedCategory];
  if (!metricHistory) {
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
