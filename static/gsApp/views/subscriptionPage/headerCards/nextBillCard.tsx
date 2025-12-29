import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {PreviewData, Subscription} from 'getsentry/types';
import {
  displayBudgetName,
  getCreditApplied,
  getCredits,
  getFees,
} from 'getsentry/utils/billing';
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

  // recurring fees, PAYG, and credits are grouped together
  // only additional fees (ie. taxes) are listed individually
  const invoiceItems = nextBill?.invoiceItems ?? [];
  const planItem = invoiceItems.find(item => item.type === 'subscription');
  const plan = planItem?.data.plan;
  const isAnnualPlan = plan?.endsWith('_auf');
  const reservedTotal =
    (planItem ? planItem.amount : 0) +
    invoiceItems
      .filter(item => item.type.startsWith('reserved_'))
      .reduce((acc, item) => acc + item.amount, 0);
  const paygTotal = invoiceItems
    .filter(item => item.type.startsWith('ondemand_'))
    .reduce((acc, item) => acc + item.amount, 0);
  const seerItem = invoiceItems.find(item => item.type === 'activated_seer_users');
  const fees = getFees({invoiceItems});
  const credits = getCredits({invoiceItems}); // these should all be negative already

  // TODO(isabella): Update the getCreditApplied function to return a negative value
  // and correct places where it's used
  const creditApplied =
    -1 *
    getCreditApplied({
      creditApplied: nextBill?.creditApplied ?? 0,
      invoiceItems,
    });
  const creditTotal = credits.reduce((acc, item) => acc + item.amount, 0) + creditApplied;

  // fallback to next on-demand period start
  const nextBillDate = nextBill?.effectiveAt
    ? moment(nextBill?.effectiveAt)
    : moment(subscription.onDemandPeriodEnd).add(1, 'days');
  const daysLeft = -1 * getDaysSinceDate(nextBillDate.format('YYYY-MM-DD'));

  return (
    <SubscriptionHeaderCard
      sections={[
        <Flex
          justify="between"
          align="start"
          key="title"
          width="100%"
          wrap="wrap"
          gap="sm"
        >
          <Heading as="h2" size="lg">
            {t('Next bill')}
          </Heading>
          {isLoading ? (
            <Placeholder height="20px" width="150px" />
          ) : (
            <Tag type="info">
              {tct('[billDate]・in [daysLeft] days', {
                billDate: nextBillDate.format('MMM D, YYYY'),
                daysLeft,
              })}
            </Tag>
          )}
        </Flex>,
        isLoading ? (
          <Placeholder style={{flexGrow: 1}} />
        ) : isError ? (
          <Alert type="danger">
            {t('Could not compute next bill. Please try again later.')}
          </Alert>
        ) : (
          <Flex direction="column" gap="lg" width="100%">
            <Text size="2xl" variant="accent" bold>
              {displayPriceWithCents({cents: nextBill?.billedAmount ?? 0})}
            </Text>
            <Flex direction="column" gap="xs">
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
              {paygTotal > 0 && (
                <Flex justify="between" align="center">
                  <Text variant="muted" size="sm">
                    {displayBudgetName(subscription.planDetails, {title: true})}
                  </Text>
                  <Text variant="muted" size="sm">
                    {displayPriceWithCents({cents: paygTotal})}
                  </Text>
                </Flex>
              )}
              {seerItem && (
                <Flex justify="between" align="center">
                  <Text variant="muted" size="sm">
                    {seerItem.description}
                  </Text>
                  <Text variant="muted" size="sm">
                    {displayPriceWithCents({cents: seerItem.amount})}
                  </Text>
                </Flex>
              )}
              {fees.map(item => (
                <Flex justify="between" align="center" key={item.type}>
                  <Text variant="muted" size="sm">
                    {item.description}
                  </Text>
                  <Text variant="muted" size="sm">
                    {displayPriceWithCents({cents: item.amount})}
                  </Text>
                </Flex>
              ))}
              {creditTotal < 0 && (
                <Flex justify="between" align="center">
                  <Text variant="muted" size="sm">
                    {t('Credits')}
                  </Text>
                  <Text variant="muted" size="sm">
                    {displayPriceWithCents({cents: creditTotal})}
                  </Text>
                </Flex>
              )}
            </Flex>
          </Flex>
        ),
      ]}
    />
  );
}

export default NextBillCard;
