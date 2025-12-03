import {Container, Flex} from 'sentry/components/core/layout';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import useOrganization from 'sentry/utils/useOrganization';

import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {
  type BillingMetricHistory,
  type CustomerUsage,
  type Subscription,
} from 'getsentry/types';
import UsageCharts from 'getsentry/views/subscriptionPage/usageOverview/components/charts';

interface CategoryUsageDrawerProps {
  categoryInfo: BillingMetricHistory;
  subscription: Subscription;
  usageData: CustomerUsage;
}

function CategoryUsageDrawer({
  categoryInfo,
  subscription,
  usageData,
}: CategoryUsageDrawerProps) {
  const organization = useOrganization();
  const {category} = categoryInfo;

  // XXX(isabella): using this to make knip happy til the hook is used in other places
  const {displayName} = useProductBillingMetadata(subscription, category);

  return (
    <Container>
      <DrawerHeader>
        <Flex align="center">{displayName}</Flex>
      </DrawerHeader>
      <DrawerBody>
        <UsageCharts
          selectedProduct={category}
          usageData={usageData}
          subscription={subscription}
          organization={organization}
        />
      </DrawerBody>
    </Container>
  );
}

export default CategoryUsageDrawer;
