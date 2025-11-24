import {useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {IconDownload, IconTable, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useNavContext} from 'sentry/views/nav/context';

import {GIGABYTE} from 'getsentry/constants';
import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import {type CustomerUsage, type Subscription} from 'getsentry/types';
import {
  formatReservedWithUnits,
  formatUsageWithUnits,
  getPercentage,
  MILLISECONDS_IN_HOUR,
  supportsPayg,
} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';

interface UsageOverviewProps {
  organization: Organization;
  subscription: Subscription;
}

function NewUsageOverviewTable({
  subscription,
  onRowClick,
  selectedProduct,
}: UsageOverviewProps & {
  onRowClick: (category: DataCategory) => void;
  selectedProduct: DataCategory | undefined;
}) {
  const addOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOnInfo => addOnInfo.dataCategories);

  return (
    <Grid
      columns="max-content auto max-content"
      background="primary"
      borderTop="primary"
      radius="0 0 md"
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
      {Object.values(subscription.categories)
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
          const percentUsed = rawPrepaid ? getPercentage(usage, rawPrepaid) : undefined;

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
              <Text>{displayName}</Text>
              <Flex align="center" gap="xs">
                {usageExceeded && <IconWarning size="sm" color="danger" />}
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
  selectedProduct,
  subscription,
  usageData,
}: {
  selectedProduct: DataCategory;
  subscription: Subscription;
  usageData: CustomerUsage;
}) {
  const displayName = getPlanCategoryName({
    plan: subscription.planDetails,
    category: selectedProduct,
    title: true,
  });
  return (
    <Container background="primary" border="primary" radius="md" padding="lg">
      <Heading as="h3">{displayName}</Heading>
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
  background: ${p => (p.isSelected ? p.theme.backgroundSecondary : p.theme.background)};
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  padding: ${p => p.theme.space.xl};
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;
