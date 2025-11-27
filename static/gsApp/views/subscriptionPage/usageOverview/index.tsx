import {useEffect, useState} from 'react';
import moment from 'moment-timezone';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

import {AddOnCategory} from 'getsentry/types';
import {checkIsAddOn} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import UsageOverviewActions from 'getsentry/views/subscriptionPage/usageOverview/components/actions';
import ProductBreakdownPanel from 'getsentry/views/subscriptionPage/usageOverview/components/panel';
import UsageOverviewTable from 'getsentry/views/subscriptionPage/usageOverview/components/table';
import type {UsageOverviewProps} from 'getsentry/views/subscriptionPage/usageOverview/type';

function UsageOverview({subscription, organization, usageData}: UsageOverviewProps) {
  const [selectedProduct, setSelectedProduct] = useState<DataCategory | AddOnCategory>(
    DataCategory.ERRORS
  );
  const navigate = useNavigate();
  const location = useLocation();
  const {isCollapsed: navIsCollapsed} = useNavContext();
  const {layout: navLayout} = useNavContext();
  const isMobile = navLayout === NavLayout.MOBILE;

  const startDate = moment(subscription.onDemandPeriodStart);
  const endDate = moment(subscription.onDemandPeriodEnd);
  const startsAndEndsSameYear = startDate.year() === endDate.year();

  useEffect(() => {
    const productFromQuery = location.query.product as string;
    if (productFromQuery) {
      const isAddOn = checkIsAddOn(productFromQuery);
      const selection = isAddOn
        ? (productFromQuery as AddOnCategory)
        : (productFromQuery as DataCategory);
      if (selectedProduct !== selection) {
        const isSelectable = isAddOn
          ? selection in subscription.planDetails.addOnCategories
          : selection in subscription.planDetails.categories;
        if (isSelectable) {
          setSelectedProduct(selection);
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
    subscription.planDetails.addOnCategories,
    subscription.planDetails.categories,
  ]);

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
      {!isMobile && (
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
