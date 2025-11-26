import {Fragment} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {
  BillingMetricHistory,
  Plan,
  ReservedBudget,
  Subscription,
} from 'getsentry/types';
import {displayBudgetName, formatReservedWithUnits} from 'getsentry/utils/billing';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

function UsageBreakdownField({
  field,
  value,
}: {
  field: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <Flex direction="column" gap="sm">
      <Text variant="muted" bold uppercase size="sm">
        {field}
      </Text>
      <Text size="lg">{value}</Text>
    </Flex>
  );
}

function UsageBreakdownInfo({
  plan,
  platformReservedField,
  formattedPlatformReserved,
  formattedAdditionalReserved,
  formattedGifted,
  paygSpend,
  paygCategoryBudget,
  recurringReservedSpend,
  canUsePayg,
}: {
  canUsePayg: boolean;
  formattedAdditionalReserved: React.ReactNode | null;
  formattedGifted: React.ReactNode;
  formattedPlatformReserved: React.ReactNode;
  paygCategoryBudget: number | null;
  paygSpend: number;
  plan: Plan;
  platformReservedField: React.ReactNode;
  recurringReservedSpend: number;
}) {
  return (
    <Grid columns="repeat(2, 1fr)" gap="md lg" padding="xl">
      <Flex direction="column" gap="lg">
        <Text bold>{t('Included volume')}</Text>
        <UsageBreakdownField
          field={platformReservedField}
          value={formattedPlatformReserved}
        />
        {formattedAdditionalReserved && (
          <UsageBreakdownField
            field={t('Additional reserved')}
            value={formattedAdditionalReserved}
          />
        )}
        <UsageBreakdownField field={t('Gifted')} value={formattedGifted} />
      </Flex>
      <Flex direction="column" gap="lg">
        <Text bold>{t('Additional spend')}</Text>
        {canUsePayg && (
          <UsageBreakdownField
            field={displayBudgetName(plan, {title: true})}
            value={
              <Fragment>
                {displayPriceWithCents({cents: paygSpend})}
                {!!paygCategoryBudget && (
                  <Fragment>
                    /
                    <Text variant="muted">
                      {displayPriceWithCents({cents: paygCategoryBudget})}
                    </Text>
                  </Fragment>
                )}
              </Fragment>
            }
          />
        )}
        <UsageBreakdownField
          field={t('Reserved spend')}
          value={displayPriceWithCents({cents: recurringReservedSpend})}
        />
      </Flex>
    </Grid>
  );
}

function DataCategoryUsageBreakdownInfo({
  plan,
  category,
  metricHistory,
}: {
  category: DataCategory;
  metricHistory: BillingMetricHistory;
  plan: Plan;
}) {
  const canUsePayg = plan.onDemandCategories.includes(category);
  const platformReserved =
    plan.planCategories[category]?.find(
      bucket => bucket.price === 0 && bucket.events >= 0
    )?.events ?? 0;
  const platformReservedField = tct('[planName] plan', {planName: plan.name});
  const formattedPlatformReserved = formatReservedWithUnits(platformReserved, category);
  const reserved = metricHistory.reserved ?? 0;
  const additionalReserved = Math.max(0, reserved - platformReserved);
  const formattedAdditionalReserved = formatReservedWithUnits(
    additionalReserved,
    category
  );
  const gifted = metricHistory.free ?? 0;
  const formattedGifted = formatReservedWithUnits(gifted, category);

  const paygSpend = metricHistory.onDemandSpendUsed ?? 0;
  const paygCategoryBudget = metricHistory.onDemandBudget ?? 0;

  const recurringReservedSpend =
    plan.planCategories[category]?.find(bucket => bucket.events === reserved)?.price ?? 0;

  return (
    <UsageBreakdownInfo
      plan={plan}
      platformReservedField={platformReservedField}
      formattedPlatformReserved={formattedPlatformReserved}
      formattedAdditionalReserved={formattedAdditionalReserved}
      formattedGifted={formattedGifted}
      paygSpend={paygSpend}
      paygCategoryBudget={paygCategoryBudget}
      recurringReservedSpend={recurringReservedSpend}
      canUsePayg={canUsePayg}
    />
  );
}

function ReservedBudgetUsageBreakdownInfo({
  subscription,
  reservedBudget,
}: {
  reservedBudget: ReservedBudget;
  subscription: Subscription;
}) {
  const {planDetails: plan, categories: metricHistories} = subscription;
  const canUsePayg = reservedBudget.dataCategories.every(category =>
    plan.onDemandCategories.includes(category)
  );
  const platformReservedField = tct('[productName] monthly credits', {
    productName: toTitleCase(reservedBudget.productName, {
      allowInnerUpperCase: true,
    }),
  });
  const formattedPlatformReserved = displayPriceWithCents({
    cents: reservedBudget.reservedBudget,
  });
  const formattedAdditionalReserved = null;
  const formattedGift = displayPriceWithCents({cents: reservedBudget.freeBudget});
  const paygSpend = reservedBudget.dataCategories.reduce((acc, category) => {
    return acc + (metricHistories[category]?.onDemandSpendUsed ?? 0);
  }, 0);
  const recurringReservedSpend =
    plan.planCategories[reservedBudget.dataCategories[0]!]?.find(
      bucket => bucket.events === RESERVED_BUDGET_QUOTA
    )?.price ?? 0;

  return (
    <UsageBreakdownInfo
      plan={plan}
      platformReservedField={platformReservedField}
      formattedPlatformReserved={formattedPlatformReserved}
      formattedAdditionalReserved={formattedAdditionalReserved}
      formattedGifted={formattedGift}
      paygSpend={paygSpend}
      paygCategoryBudget={null}
      recurringReservedSpend={recurringReservedSpend}
      canUsePayg={canUsePayg}
    />
  );
}

export {DataCategoryUsageBreakdownInfo, ReservedBudgetUsageBreakdownInfo};
