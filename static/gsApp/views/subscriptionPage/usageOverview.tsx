import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import ProgressRing from 'sentry/components/progressRing';
import {
  IconClock,
  IconDownload,
  IconLightning,
  IconOpen,
  IconTable,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {useNavContext} from 'sentry/views/nav/context';

import StartTrialButton from 'getsentry/components/startTrialButton';
import {GIGABYTE} from 'getsentry/constants';
import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import {
  OnDemandBudgetMode,
  type CustomerUsage,
  type ProductTrial,
  type Subscription,
} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getPercentage,
  getPotentialProductTrial,
  MILLISECONDS_IN_HOUR,
  supportsPayg,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
  sortCategories,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';

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

  const tooltipContent = potentialProductTrial
    ? t('Trial available')
    : tct('[daysLeft] days left', {
        daysLeft: -1 * getDaysSinceDate(activeProductTrial!.endDate ?? ''),
      });

  return (
    <Flex position="absolute" style={{left: '-1px', top: '16px'}} z-index="1000">
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

function NewUsageOverviewTable({
  subscription,
  onRowClick,
  selectedProduct,
}: UsageOverviewProps & {
  onRowClick: (category: DataCategory) => void;
  selectedProduct: DataCategory | undefined;
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
    </Grid>
  );
}

function ProductBreakdown({
  organization,
  selectedProduct,
  subscription,
  usageData,
}: {
  organization: Organization;
  selectedProduct: DataCategory;
  subscription: Subscription;
  usageData: CustomerUsage;
}) {
  const [trialButtonBusy, setTrialButtonBusy] = useState(false);

  const displayName = getPlanCategoryName({
    plan: subscription.planDetails,
    category: selectedProduct,
    title: true,
  });
  const metricHistory = subscription.categories[selectedProduct];
  const categoryInfo = getCategoryInfoFromPlural(selectedProduct);
  if (!metricHistory || !categoryInfo) {
    return null;
  }
  const {productName} = categoryInfo;
  const {
    reserved,
    free,
    usageExceeded,
    onDemandSpendUsed: paygSpendUsed,
    onDemandBudget: paygCategoryBudget,
  } = metricHistory;
  const baseVolume =
    subscription.planDetails.planCategories[selectedProduct]?.find(
      bucket => bucket.price === 0 && bucket.events >= 0
    )?.events ?? 0;
  const reservedSpend =
    subscription.planDetails.planCategories[selectedProduct]?.find(
      bucket => bucket.events === reserved
    )?.events ?? 0;
  const {onDemandBudgets: paygBudgets} = subscription;
  const hasPayg =
    supportsPayg(subscription) &&
    ((paygBudgets?.budgetMode === OnDemandBudgetMode.SHARED &&
      paygBudgets.sharedMaxBudget > 0) ||
      (paygBudgets?.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
        (paygBudgets?.budgets[selectedProduct] ?? 0) > 0));

  const activeProductTrial = getActiveProductTrial(
    subscription.productTrials ?? null,
    selectedProduct
  );
  const potentialProductTrial = getPotentialProductTrial(
    subscription.productTrials ?? null,
    selectedProduct
  );

  const status = activeProductTrial ? (
    <Tag type="promotion" icon={<IconClock />}>
      {tct('Trial - [daysLeft] days left', {
        daysLeft: -1 * getDaysSinceDate(activeProductTrial.endDate ?? ''),
      })}
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
          columns="1fr auto"
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
        <Text bold>{t('Included volume')}</Text>
        <Text bold>{t('Additional spend')}</Text>
        <Text bold uppercase variant="muted" size="sm">
          {tct('[planName] plan', {planName: subscription.planDetails.name})}
        </Text>
        <Text bold uppercase variant="muted" size="sm">
          {displayBudgetName(subscription.planDetails, {title: true})}
        </Text>
        <Text size="lg">{formatReservedWithUnits(baseVolume, selectedProduct)}</Text>
        <Text size="lg" as="div">
          {displayPriceWithCents({cents: paygSpendUsed})}
          {paygCategoryBudget > 0 && (
            <Fragment>
              /
              <Text variant="muted">
                {displayPriceWithCents({cents: paygCategoryBudget})}
              </Text>
            </Fragment>
          )}
        </Text>
        <Text bold uppercase variant="muted" size="sm">
          {t('Additional reserved')}
        </Text>
        <Text bold uppercase variant="muted" size="sm">
          {t('Reserved spend')}
        </Text>
        <Text size="lg">
          {formatReservedWithUnits(
            Math.max(0, (reserved ?? 0) - baseVolume),
            selectedProduct
          )}
        </Text>
        <Text size="lg">{displayPriceWithCents({cents: reservedSpend})}</Text>
        <Text bold uppercase variant="muted" size="sm">
          {t('Gifted')}
        </Text>
        <div />
        <Text size="lg">{formatReservedWithUnits(free, selectedProduct)}</Text>
      </Grid>
    </Container>
  );
}

function UsageOverview({
  subscription,
  organization,
  usageData,
}: UsageOverviewProps & {usageData: CustomerUsage}) {
  const [selectedProduct, setSelectedProduct] = useState<DataCategory>(
    DataCategory.ERRORS
  );
  const hasBillingPerms = organization.access.includes('org:billing');
  const {isCollapsed: navIsCollapsed} = useNavContext();
  const {currentHistory, isPending, isError} = useCurrentBillingHistory();
  const startDate = moment(subscription.onDemandPeriodStart);
  const endDate = moment(subscription.onDemandPeriodEnd);
  const startsAndEndsSameYear = startDate.year() === endDate.year();

  return (
    <Grid
      columns={{xs: '1fr', md: navIsCollapsed ? `3fr 2fr` : '1fr', lg: '3fr 2fr'}}
      gap="lg"
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
        <NewUsageOverviewTable
          subscription={subscription}
          organization={organization}
          onRowClick={setSelectedProduct}
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
