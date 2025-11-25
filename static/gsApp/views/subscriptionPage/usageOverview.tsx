import {Fragment, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {ChartControls, InlineContainer} from 'sentry/components/charts/styles';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import ProgressRing from 'sentry/components/progressRing';
import {
  IconClock,
  IconDownload,
  IconLightning,
  IconLock,
  IconOpen,
  IconTable,
  IconWarning,
} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useNavContext} from 'sentry/views/nav/context';
import {CHART_OPTIONS_DATA_TRANSFORM} from 'sentry/views/organizationStats/usageChart';

import StartTrialButton from 'getsentry/components/startTrialButton';
import {GIGABYTE, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import {
  AddOnCategory,
  OnDemandBudgetMode,
  type CustomerUsage,
  type ProductTrial,
  type Subscription,
} from 'getsentry/types';
import {
  addBillingStatTotals,
  displayBudgetName,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getPercentage,
  getPotentialProductTrial,
  getReservedBudgetCategoryForAddOn,
  isAm2Plan,
  MILLISECONDS_IN_HOUR,
  supportsPayg,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getChunkCategoryFromDuration,
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
  sortCategories,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';
import {
  ProductUsageChart,
  selectedTransform,
} from 'getsentry/views/subscriptionPage/reservedUsageChart';
import {EMPTY_STAT_TOTAL} from 'getsentry/views/subscriptionPage/usageTotals';
import UsageTotalsTable from 'getsentry/views/subscriptionPage/usageTotalsTable';

interface UsageOverviewProps {
  organization: Organization;
  subscription: Subscription;
}

function ProductTrialRibbon({
  activeProductTrial,
  potentialProductTrial,
}: {
  activeProductTrial: ProductTrial | null;
  potentialProductTrial: ProductTrial | null;
}) {
  const theme = useTheme();
  const iconProps = {
    size: 'xs' as const,
    color: 'white' as const,
  };
  const ribbonColor = activeProductTrial
    ? theme.tokens.graphics.promotion
    : theme.tokens.graphics.accent;

  if (!activeProductTrial && !potentialProductTrial) {
    return null;
  }

  const trialDaysLeft = -1 * getDaysSinceDate(activeProductTrial?.endDate ?? '');
  const tooltipContent = potentialProductTrial
    ? t('Trial available')
    : tn('%s day left', '%s days left', trialDaysLeft);

  return (
    <Flex position="absolute" style={{left: '-1px', top: '14px'}} z-index="1000">
      <RibbonBase ribbonColor={ribbonColor}>
        <Tooltip title={tooltipContent}>
          {activeProductTrial ? (
            <IconClock {...iconProps} />
          ) : (
            <IconLightning {...iconProps} />
          )}
        </Tooltip>
      </RibbonBase>
      <Flex direction="column" position="relative">
        <TopRibbonEdge ribbonColor={ribbonColor} />
        <BottomRibbonEdge ribbonColor={ribbonColor} />
      </Flex>
    </Flex>
  );
}

function UsageOverviewTable({
  organization,
  subscription,
  onRowClick,
  selectedProduct,
}: UsageOverviewProps & {
  onRowClick: (category: DataCategory | AddOnCategory) => void;
  selectedProduct: DataCategory | AddOnCategory;
}) {
  const theme = useTheme();
  const addOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOnInfo => addOnInfo.dataCategories);

  return (
    <Grid
      columns="max-content auto max-content"
      background="primary"
      borderTop="primary"
      radius="0 0 md md"
      gap="0 3xl"
      width="100%"
    >
      <TableHeader>
        <Text bold variant="muted">
          {t('FEATURE')}
        </Text>
        <Text bold variant="muted">
          {t('USAGE')}
        </Text>
        <Text bold variant="muted" align="right">
          {t('ADDITIONAL SPEND')}
        </Text>
      </TableHeader>
      {sortCategories(subscription.categories)
        .filter(categoryInfo => !addOnDataCategories.includes(categoryInfo.category))
        .map(categoryInfo => {
          const {category, usage, prepaid, reserved, usageExceeded, onDemandSpendUsed} =
            categoryInfo;
          const displayName = getPlanCategoryName({
            plan: subscription.planDetails,
            category,
            title: true,
          });
          const formattedPrepaid = formatReservedWithUnits(prepaid, category, {
            useUnitScaling: true,
            isAbbreviated: true,
          });
          const formattedUsage = formatUsageWithUnits(usage, category, {
            useUnitScaling: true,
            isAbbreviated: true,
          });
          const isPaygOnly = reserved === 0 && supportsPayg(subscription);

          const bucket = getBucket({
            events: reserved ?? 0, // buckets use the converted unit reserved amount (ie. in GB for byte categories)
            buckets: subscription.planDetails.planCategories[category],
          });
          const recurringReservedSpend = bucket.price ?? 0;
          const additionalSpend = recurringReservedSpend + onDemandSpendUsed;
          const formattedAdditionalSpend = displayPriceWithCents({
            cents: additionalSpend,
          });

          // convert prepaid amount to the same unit as usage to accurately calculate percent used
          const rawPrepaid = isByteCategory(category)
            ? prepaid * GIGABYTE
            : isContinuousProfiling(category)
              ? prepaid * MILLISECONDS_IN_HOUR
              : prepaid;
          const percentUsed = rawPrepaid ? getPercentage(usage, rawPrepaid) : 0;

          const activeProductTrial = getActiveProductTrial(
            subscription.productTrials ?? null,
            category
          );
          const potentialProductTrial = getPotentialProductTrial(
            subscription.productTrials ?? null,
            category
          );

          return (
            <TableRow
              key={category}
              isSelected={selectedProduct === category}
              onClick={() => onRowClick(category)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onRowClick(category);
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
              <Container
                paddingLeft={
                  activeProductTrial || potentialProductTrial ? 'lg' : undefined
                }
              >
                <Text>{displayName}</Text>
              </Container>
              <Flex align="center" gap="xs">
                {usageExceeded ? (
                  <IconWarning size="sm" color="danger" />
                ) : isPaygOnly ? null : (
                  <ProgressRing
                    value={percentUsed}
                    progressColor={
                      !usageExceeded && percentUsed === 100
                        ? theme.warningFocus
                        : undefined
                    }
                  />
                )}
                <Text>
                  {isPaygOnly
                    ? formattedUsage
                    : `${formattedUsage} / ${formattedPrepaid}`}
                </Text>
              </Flex>
              <Text align="right">{formattedAdditionalSpend}</Text>
            </TableRow>
          );
        })}
      {Object.values(subscription.planDetails.addOnCategories)
        .filter(
          addOnInfo =>
            !addOnInfo.billingFlag ||
            organization.features.includes(addOnInfo.billingFlag)
        )
        .map(addOnInfo => {
          const {apiName, dataCategories, productName} = addOnInfo;
          const isEnabled = subscription.addOns?.[apiName]?.enabled;

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

          const activeProductTrial = getActiveProductTrial(
            subscription.productTrials ?? null,
            billedCategory
          );
          const potentialProductTrial = getPotentialProductTrial(
            subscription.productTrials ?? null,
            billedCategory
          );

          const prepaid = reservedBudget?.reservedBudget ?? null;
          const usage =
            reservedBudget?.totalReservedSpend ??
            subscription.categories[billedCategory]?.usage ??
            0;
          const percentUsed = prepaid ? getPercentage(usage, prepaid) : 0;
          const usageExceeded =
            subscription.categories[billedCategory]?.usageExceeded ?? false;

          const formattedUsage = reservedBudget
            ? displayPriceWithCents({cents: usage})
            : formatUsageWithUnits(usage, billedCategory, {
                useUnitScaling: true,
                isAbbreviated: true,
              });
          const formattedPrepaid = reservedBudget
            ? displayPriceWithCents({cents: prepaid ?? 0})
            : defined(prepaid)
              ? formatReservedWithUnits(prepaid, billedCategory, {
                  useUnitScaling: true,
                  isAbbreviated: true,
                })
              : null;

          const recurringReservedSpend =
            isEnabled && defined(billedCategory)
              ? (subscription.planDetails.planCategories[billedCategory]?.find(
                  bucket =>
                    bucket.events ===
                    (subscription.categories[billedCategory]?.reserved ?? 0)
                )?.price ?? 0)
              : 0;
          const paygSpend = dataCategories.reduce((acc, category) => {
            return acc + (subscription.categories[category]?.onDemandSpendUsed ?? 0);
          }, 0);
          const additionalSpend = recurringReservedSpend + paygSpend;
          const formattedAdditionalSpend = displayPriceWithCents({
            cents: additionalSpend,
          });

          return (
            <TableRow
              key={apiName}
              isSelected={selectedProduct === apiName}
              onClick={() => onRowClick(apiName)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onRowClick(apiName);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={t('View %s usage', productName)}
            >
              {(activeProductTrial || potentialProductTrial) && (
                <ProductTrialRibbon
                  activeProductTrial={activeProductTrial}
                  potentialProductTrial={potentialProductTrial}
                />
              )}
              <Flex
                paddingLeft={
                  activeProductTrial || potentialProductTrial ? 'lg' : undefined
                }
                gap="xs"
                align="center"
              >
                <Text variant={isEnabled ? 'primary' : 'muted'}>
                  {toTitleCase(productName, {allowInnerUpperCase: true})}
                </Text>
                {!isEnabled && <IconLock size="sm" locked color="disabled" />}
              </Flex>
              {isEnabled && (
                <Fragment>
                  <Flex align="center" gap="xs">
                    {usageExceeded ? (
                      <IconWarning size="sm" color="danger" />
                    ) : defined(prepaid) ? (
                      <ProgressRing
                        value={percentUsed}
                        progressColor={
                          !usageExceeded && percentUsed === 100
                            ? theme.warningFocus
                            : undefined
                        }
                      />
                    ) : null}
                    <Text>
                      {defined(prepaid)
                        ? `${formattedUsage} / ${formattedPrepaid}`
                        : formattedUsage}
                    </Text>
                  </Flex>
                  <Text align="right">{formattedAdditionalSpend}</Text>
                </Fragment>
              )}
            </TableRow>
          );
        })}
    </Grid>
  );
}

function BreakdownField({
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

function ProductBreakdown({
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
        {/* <Grid columns="repeat(2, 1fr)" gap="md lg" padding="xl">
          <Flex direction="column" gap="lg">
            <Text bold>{t('Included volume')}</Text>
            <BreakdownField
              field={tct('[planName] plan', {planName: subscription.planDetails.name})}
              value={formatReservedWithUnits(baseVolume, category)}
            />
            <BreakdownField
              field={t('Additional reserved')}
              value={formatReservedWithUnits(
                Math.max(0, (reserved ?? 0) - baseVolume),
                category
              )}
            />
            <BreakdownField
              field={t('Gifted')}
              value={formatReservedWithUnits(free, category)}
            />
          </Flex>
          <Flex direction="column" gap="lg">
            <Text bold>{t('Additional spend')}</Text>
            {subscription.planDetails.onDemandCategories.includes(category) && (
              <BreakdownField
                field={displayBudgetName(subscription.planDetails, {title: true})}
                value={
                  <Fragment>
                    {displayPriceWithCents({cents: paygSpendUsed})}
                    {paygCategoryBudget > 0 && (
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
            <BreakdownField
              field={t('Reserved spend')}
              value={displayPriceWithCents({cents: reservedSpend})}
            />
          </Flex>
        </Grid> */}
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
  const {
    reserved,
    free,
    usageExceeded,
    usage: billedUsage,
    onDemandSpendUsed: paygSpendUsed,
    onDemandBudget: paygCategoryBudget,
  } = metricHistory;
  const baseVolume =
    subscription.planDetails.planCategories[category]?.find(
      bucket => bucket.price === 0 && bucket.events >= 0
    )?.events ?? 0;
  const reservedSpend =
    subscription.planDetails.planCategories[category]?.find(
      bucket => bucket.events === reserved
    )?.price ?? 0;
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
      <Grid columns="repeat(2, 1fr)" gap="md lg" padding="xl">
        <Flex direction="column" gap="lg">
          <Text bold>{t('Included volume')}</Text>
          <BreakdownField
            field={tct('[planName] plan', {planName: subscription.planDetails.name})}
            value={formatReservedWithUnits(baseVolume, category)}
          />
          <BreakdownField
            field={t('Additional reserved')}
            value={formatReservedWithUnits(
              Math.max(0, (reserved ?? 0) - baseVolume),
              category
            )}
          />
          <BreakdownField
            field={t('Gifted')}
            value={formatReservedWithUnits(free, category)}
          />
        </Flex>
        <Flex direction="column" gap="lg">
          <Text bold>{t('Additional spend')}</Text>
          {subscription.planDetails.onDemandCategories.includes(category) && (
            <BreakdownField
              field={displayBudgetName(subscription.planDetails, {title: true})}
              value={
                <Fragment>
                  {displayPriceWithCents({cents: paygSpendUsed})}
                  {paygCategoryBudget > 0 && (
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
          <BreakdownField
            field={t('Reserved spend')}
            value={displayPriceWithCents({cents: reservedSpend})}
          />
        </Flex>
      </Grid>
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

function UsageOverview({
  subscription,
  organization,
  usageData,
}: UsageOverviewProps & {usageData: CustomerUsage}) {
  const [selectedProduct, setSelectedProduct] = useState<DataCategory | AddOnCategory>(
    DataCategory.ERRORS
  );
  const navigate = useNavigate();
  const location = useLocation();
  const hasBillingPerms = organization.access.includes('org:billing');
  const {isCollapsed: navIsCollapsed} = useNavContext();
  const {currentHistory, isPending, isError} = useCurrentBillingHistory();
  const startDate = moment(subscription.onDemandPeriodStart);
  const endDate = moment(subscription.onDemandPeriodEnd);
  const startsAndEndsSameYear = startDate.year() === endDate.year();

  useEffect(() => {
    if (location.query.product) {
      const productFromQuery = location.query.product as DataCategory;
      if (selectedProduct !== productFromQuery) {
        setSelectedProduct(productFromQuery);
      }
    }
  }, [location.query.product, selectedProduct]);

  return (
    <Grid
      columns={{xs: '1fr', md: navIsCollapsed ? `3fr 2fr` : '1fr', lg: '3fr 2fr'}}
      gap="lg"
      align="start"
    >
      <Container radius="md" border="primary" background="primary" width="100%">
        <Flex
          justify="between"
          align={{xs: 'start', sm: 'center'}}
          padding="lg xl"
          gap="xl"
          direction={{xs: 'column', sm: 'row'}}
        >
          <Flex direction="column" gap="sm">
            <Heading as="h3" size="lg">
              {tct('Usage: [period]', {
                period: `${startDate.format(startsAndEndsSameYear ? 'MMM D' : 'MMM D, YYYY')} - ${endDate.format('MMM D, YYYY')}`,
              })}
            </Heading>
          </Flex>
          {hasBillingPerms && (
            <Flex gap="lg" direction={{xs: 'column', sm: 'row'}}>
              <LinkButton
                icon={<IconTable />}
                priority="default"
                to="/settings/billing/usage/"
              >
                {t('View all usage')}
              </LinkButton>
              <Button
                icon={<IconDownload />}
                disabled={isPending || isError}
                onClick={() => {
                  trackGetsentryAnalytics('subscription_page.download_reports.clicked', {
                    organization,
                    reportType: 'summary',
                  });
                  if (currentHistory) {
                    window.open(currentHistory.links.csv, '_blank');
                  }
                }}
              >
                {t('Download as CSV')}
              </Button>
            </Flex>
          )}
        </Flex>
        <UsageOverviewTable
          subscription={subscription}
          organization={organization}
          onRowClick={product => {
            setSelectedProduct(product);
            trackGetsentryAnalytics('subscription_page.usage_overview.row_clicked', {
              organization,
              subscription,
              ...(Object.values(AddOnCategory).includes(product as AddOnCategory)
                ? {addOnCategory: product as AddOnCategory}
                : {dataCategory: product as DataCategory}),
            });
            navigate(
              {
                pathname: location.pathname,
                query: {
                  ...location.query,
                  product,
                },
              },
              {replace: true}
            );
          }}
          selectedProduct={selectedProduct}
        />
      </Container>
      <ProductBreakdown
        organization={organization}
        selectedProduct={selectedProduct}
        subscription={subscription}
        usageData={usageData}
      />
    </Grid>
  );
}

export default UsageOverview;

const TableHeader = styled('th')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  text-transform: uppercase;
  padding: ${p => p.theme.space.xl};
`;

const TableRow = styled('tr')<{isSelected: boolean}>`
  position: relative;
  background: ${p => (p.isSelected ? p.theme.backgroundSecondary : p.theme.background)};
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  padding: ${p => p.theme.space.xl};
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const RibbonBase = styled('div')<{ribbonColor: string}>`
  width: 20px;
  height: 22px;
  background: ${p => p.ribbonColor};
  padding: ${p => `${p.theme.space['2xs']} ${p.theme.space.xs}`};
`;

const BottomRibbonEdge = styled('div')<{ribbonColor: string}>`
  position: absolute;
  top: auto;
  bottom: 0;
  width: 0px;
  height: 0px;
  border-style: solid;
  border-color: transparent transparent ${p => p.ribbonColor} transparent;
  border-width: 11px 5.5px 11px 0px;
`;

const TopRibbonEdge = styled(BottomRibbonEdge)`
  transform: scaleY(-1);
  top: 0;
  bottom: auto;
`;
