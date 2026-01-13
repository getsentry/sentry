import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import {useNavigate} from 'sentry/utils/useNavigate';

import {AddOnCategory, OnDemandBudgetMode} from 'getsentry/types';
import {
  checkIsAddOn,
  checkIsAddOnChildCategory,
  getActiveProductTrial,
} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import UsageOverviewActions from 'getsentry/views/subscriptionPage/usageOverview/components/actions';
import ProductBreakdownPanel from 'getsentry/views/subscriptionPage/usageOverview/components/panel';
import UsageOverviewTable from 'getsentry/views/subscriptionPage/usageOverview/components/table';
import {
  SIDE_PANEL_MIN_SCREEN_BREAKPOINT,
  USAGE_OVERVIEW_PANEL_HEADER_HEIGHT,
} from 'getsentry/views/subscriptionPage/usageOverview/constants';
import type {UsageOverviewProps} from 'getsentry/views/subscriptionPage/usageOverview/types';

function UsageOverview({subscription, organization, usageData}: UsageOverviewProps) {
  const [selectedProduct, setSelectedProduct] = useState<DataCategory | AddOnCategory>(
    DataCategory.ERRORS
  );
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const showSidePanel = useMedia(
    `(min-width: ${theme.breakpoints[SIDE_PANEL_MIN_SCREEN_BREAKPOINT]})`
  );

  const startDate = moment(subscription.onDemandPeriodStart);
  const endDate = moment(subscription.onDemandPeriodEnd);
  const startsAndEndsSameYear = startDate.year() === endDate.year();

  useEffect(() => {
    const productFromQuery = location.query.product as string;
    if (productFromQuery) {
      const isAddOn = checkIsAddOn(productFromQuery);
      if (selectedProduct !== productFromQuery) {
        const isSelectable = isAddOn
          ? (subscription.addOns?.[productFromQuery as AddOnCategory]?.enabled ??
              false) &&
            subscription.addOns?.[
              productFromQuery as AddOnCategory
            ]?.dataCategories.every(category =>
              checkIsAddOnChildCategory(subscription, category, true)
            )
          : (subscription.categories[productFromQuery as DataCategory]?.reserved ?? 0) >
              0 ||
            !!getActiveProductTrial(
              subscription.productTrials ?? null,
              productFromQuery as DataCategory
            ) ||
            (subscription.onDemandBudgets?.budgetMode === OnDemandBudgetMode.SHARED
              ? subscription.onDemandBudgets.sharedMaxBudget
              : (subscription.onDemandBudgets?.budgets?.[
                  productFromQuery as DataCategory
                ] ?? 0)) > 0;
        if (isSelectable) {
          setSelectedProduct(
            isAddOn
              ? (productFromQuery as AddOnCategory)
              : (productFromQuery as DataCategory)
          );
        } else {
          // if the query is an unselectable product, reset the query to the existing selected product
          navigate(
            {
              pathname: location.pathname,
              query: {
                ...location.query,
                product: selectedProduct,
              },
            },
            {
              replace: true,
            }
          );
        }
      }
    }
  }, [
    location.query.product,
    selectedProduct,
    location.pathname,
    location.query,
    navigate,
    subscription,
  ]);

  return (
    <Grid
      columns={{xs: '1fr', [SIDE_PANEL_MIN_SCREEN_BREAKPOINT]: 'repeat(2, 1fr)'}}
      gap="lg"
      align="start"
    >
      <Container radius="md" border="primary" background="primary" width="100%">
        <Flex
          justify="between"
          align="center"
          padding="lg xl"
          gap="xl"
          height={USAGE_OVERVIEW_PANEL_HEADER_HEIGHT}
        >
          <Flex direction="column" gap="sm">
            <Heading as="h3" size="lg">
              {tct('Usage: [period]', {
                period: `${startDate.format(startsAndEndsSameYear ? 'MMM D' : 'MMM D, YYYY')} - ${endDate.format('MMM D, YYYY')}`,
              })}
            </Heading>
          </Flex>
          <UsageOverviewActions organization={organization} />
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
          usageData={usageData}
        />
      </Container>
      {showSidePanel && (
        <ProductBreakdownPanel
          organization={organization}
          selectedProduct={selectedProduct}
          subscription={subscription}
          usageData={usageData}
        />
      )}
    </Grid>
  );
}

export default UsageOverview;
