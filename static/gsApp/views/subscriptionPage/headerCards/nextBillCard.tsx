import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import {InvoiceItemType, type PreviewData, type Subscription} from 'getsentry/types';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';
import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

function NextBillCard({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const {
    data: nextBill,
    isLoading,
    isError,
  } = useApiQuery<PreviewData>(
    [`/customers/${organization.slug}/subscription/next-bill/`],
    {
      staleTime: 0,
      enabled: !!subscription.plan,
    }
  );

  if (isError || (!isLoading && !nextBill)) {
    return null; // assume there's no next bill
  }

  const planItem = (nextBill?.invoiceItems ?? []).find(
    item => item.type === InvoiceItemType.SUBSCRIPTION
  );
  const plan = planItem?.data.plan;
  const isAnnualPlan = plan?.endsWith('_auf');
  const reservedTotal =
    (planItem ? planItem.amount : 0) +
    (nextBill?.invoiceItems ?? [])
      .filter(item => item.type.startsWith('reserved_'))
      .reduce((acc, item) => acc + item.amount, 0);
  const onDemandTotal = (nextBill?.invoiceItems ?? [])
    .filter(item => item.type.startsWith('ondemand_'))
    .reduce((acc, item) => acc + item.amount, 0);

  return (
    <SubscriptionHeaderCard
      sections={[
        <Flex justify="between" align="center" key="title" width="100%">
          <Heading as="h2" size="lg">
            {t('Next bill')}
          </Heading>
          <Tag type="info">
            {tct('[billDate]・in [daysLeft] days', {
              billDate: moment(nextBill?.effectiveAt).format('MMM D, YYYY'),
              daysLeft: moment(nextBill?.effectiveAt).diff(moment(), 'days'),
            })}
          </Tag>
        </Flex>,
        isLoading ? (
          <Placeholder />
        ) : (
          <Flex direction="column" gap="lg" width="100%">
            <Text size="2xl" variant="accent" bold>
              {displayPriceWithCents({cents: nextBill?.billedAmount ?? 0})}
            </Text>
            {reservedTotal > 0 && (
              <Flex justify="between" align="center">
                <Text variant="muted" size="sm">
                  {tct('[interval] plan', {
                    interval: isAnnualPlan ? t('Yearly') : t('Monthly'),
                  })}
                </Text>
                <Text variant="muted" size="sm">
                  {displayPriceWithCents({cents: reservedTotal})}
                </Text>
              </Flex>
            )}
            {onDemandTotal > 0 && (
              <Flex justify="between" align="center">
                <Text variant="muted" size="sm">
                  {t('PAYG')}
                </Text>
                <Text variant="muted" size="sm">
                  {displayPriceWithCents({cents: onDemandTotal})}
                </Text>
              </Flex>
            )}
            {(nextBill?.invoiceItems ?? [])
              .filter(
                item =>
                  item.type !== InvoiceItemType.SUBSCRIPTION &&
                  !item.type.startsWith('reserved_') &&
                  !item.type.startsWith('ondemand_')
              )
              .map(item => (
                <Flex justify="between" align="center" key={item.type}>
                  <Text variant="muted" size="sm">
                    {item.description}
                  </Text>
                  <Text variant="muted" size="sm">
                    {displayPriceWithCents({cents: item.amount})}
                  </Text>
                </Flex>
              ))}
          </Flex>
        ),
      ]}
    />
  );
}

export default NextBillCard;
