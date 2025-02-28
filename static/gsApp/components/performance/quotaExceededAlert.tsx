import {Alert} from 'sentry/components/core/alert';
import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {getFormattedDate} from 'sentry/utils/dates';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import withSubscription from 'getsentry/components/withSubscription';
import {usePerformanceUsageStats} from 'getsentry/hooks/performance/usePerformanceUsageStats';
import type {Subscription} from 'getsentry/types';

const DATE_FORMAT = 'MMM DD, YYYY';

// Returns the beggining of statsPeriod formatted like "Jan 1, 2022"
// or absolute date range formatted like "Jan 1, 2022 - Jan 2, 2022"
function getFormattedDateTime(dateTime: PageFilters['datetime']): string | null {
  const {start, end, period} = dateTime;
  if (period) {
    const periodToHours = parsePeriodToHours(period);
    const periodStartDate = new Date(Date.now() - periodToHours * 60 * 60 * 1000);
    return getFormattedDate(periodStartDate, DATE_FORMAT);
  }

  if (start && end) {
    return `${getFormattedDate(new Date(start), DATE_FORMAT)} - ${getFormattedDate(new Date(end), DATE_FORMAT)}`;
  }

  return null;
}

function useQuotaExceededAlertMessage(subscription: Subscription) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  let hasExceededPerformanceUsageLimit: boolean | null = null;

  const dataCategories = subscription?.categories;
  if (dataCategories) {
    if ('transactions' in dataCategories) {
      hasExceededPerformanceUsageLimit =
        dataCategories.transactions?.usageExceeded || false;
    } else if ('spans' in dataCategories) {
      hasExceededPerformanceUsageLimit = dataCategories.spans?.usageExceeded || false;
    }
  }

  const {data: performanceUsageStats} = usePerformanceUsageStats({
    organization,
    dateRange: selection.datetime,
    projectIds: selection.projects,
  });

  // Check if events were dropped due to exceeding the transaction/spans quota
  const droppedEventsCount = performanceUsageStats?.totals['sum(quantity)'] || 0;

  if (droppedEventsCount === 0 || !hasExceededPerformanceUsageLimit || !subscription) {
    return null;
  }

  const formattedDateRange: string | null = getFormattedDateTime(selection.datetime);
  const billingPageLink = (
    <Link
      to={{
        pathname: `/settings/billing/checkout/?referrer=trace-view`,
        query: {
          skipBundles: true,
        },
      }}
    />
  );

  const subscriptionRenewalDate = getFormattedDate(
    new Date(subscription.renewalDate),
    DATE_FORMAT
  );

  if (!formattedDateRange) {
    return subscription?.onDemandBudgets?.enabled
      ? ['am1', 'am2'].includes(subscription.planTier)
        ? tct(
            'You’ve exceeded your on-demand budget during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. If you need more, [billingPageLink:increase your on-demand budget].',
            {
              subscriptionRenewalDate,
              billingPageLink,
            }
          )
        : tct(
            'You’ve exceeded your pay-as-you-go budget during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. If you need more, [billingPageLink:increase your pay-as-you-go budget].',
            {
              subscriptionRenewalDate,
              billingPageLink,
            }
          )
      : tct(
          'You’ve exceeded your reserved volumes during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. If you need more, [billingPageLink:increase your reserved volumes].',
          {
            subscriptionRenewalDate,
            billingPageLink,
          }
        );
  }

  const {period} = selection.datetime;
  return subscription?.onDemandBudgets?.enabled
    ? ['am1', 'am2'].includes(subscription.planTier)
      ? tct(
          'You’ve exceeded your on-demand budget during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. [rest]',
          {
            subscriptionRenewalDate,
            rest: period
              ? tct(
                  'If you need more, [billingPageLink: increase your on-demand budget] or adjust your date range prior to [formattedDateRange].',
                  {
                    billingPageLink,
                    formattedDateRange,
                  }
                )
              : tct(
                  'If you need more, [billingPageLink: increase your on-demand budget] or adjust your date range before or after [formattedDateRange].',
                  {
                    billingPageLink,
                    formattedDateRange,
                  }
                ),
          }
        )
      : tct(
          'You’ve exceeded your pay-as-you-go budget during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. [rest]',
          {
            subscriptionRenewalDate,
            rest: period
              ? tct(
                  'If you need more, [billingPageLink: increase your pay-as-you-go budget] or adjust your date range prior to [formattedDateRange].',
                  {
                    billingPageLink,
                    formattedDateRange,
                  }
                )
              : tct(
                  'If you need more, [billingPageLink: increase your pay-as-you-go budget] or adjust your date range before or after [formattedDateRange].',
                  {
                    billingPageLink,
                    formattedDateRange,
                  }
                ),
          }
        )
    : tct(
        'You’ve exceeded your reserved volumes during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. [rest]',
        {
          subscriptionRenewalDate,
          rest: period
            ? tct(
                'If you need more, [billingPageLink: increase your reserved volumes] or adjust your date range prior to [formattedDateRange].',
                {
                  billingPageLink,
                  formattedDateRange,
                }
              )
            : tct(
                'If you need more, [billingPageLink: increase your reserved volumes] or adjust your date range before or after [formattedDateRange].',
                {
                  billingPageLink,
                  formattedDateRange,
                }
              ),
        }
      );
}

type Props = {
  subscription: Subscription;
};

export function QuotaExceededAlert(props: Props) {
  const message = useQuotaExceededAlertMessage(props.subscription);

  if (!message) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert type="warning" showIcon>
        {message}
      </Alert>
    </Alert.Container>
  );
}

export default withSubscription(QuotaExceededAlert, {noLoader: true});
