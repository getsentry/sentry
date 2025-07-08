import {useEffect} from 'react';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Link} from 'sentry/components/core/link';
import {tct} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import withSubscription from 'getsentry/components/withSubscription';
import {usePerformanceUsageStats} from 'getsentry/hooks/performance/usePerformanceUsageStats';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

// Returns the beggining of statsPeriod formatted like "Jan 1, 2022"
// or absolute date range formatted like "Jan 1, 2022 - Jan 2, 2022"
function getFormattedDateTime(dateTime: PageFilters['datetime']): string | null {
  const {start, end, period} = dateTime;
  const format = getFormat({dateOnly: true, year: true});

  if (period) {
    const periodToHours = parsePeriodToHours(period);
    const periodStartDate = new Date(Date.now() - periodToHours * 60 * 60 * 1000);
    return getFormattedDate(periodStartDate, format);
  }

  if (start && end) {
    return `${getFormattedDate(new Date(start), format)} - ${getFormattedDate(new Date(end), format)}`;
  }

  return null;
}

function useQuotaExceededAlertMessage(
  subscription: Subscription,
  organization: Organization
) {
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

  const periodRenewalDate = moment(subscription.onDemandPeriodEnd)
    .add(1, 'days')
    .format('ll');

  if (!formattedDateRange) {
    return subscription?.onDemandBudgets?.enabled
      ? tct(
          'You’ve exceeded your [budgetType] budget during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. If you need more, [billingPageLink:increase your [budgetType] budget].',
          {
            budgetType: subscription.planDetails.budgetTerm,
            periodRenewalDate,
            billingPageLink,
          }
        )
      : tct(
          'You’ve exceeded your reserved volumes during this date range and results will be skewed. We can’t collect more spans until [periodRenewalDate]. If you need more, [billingPageLink:increase your reserved volumes].',
          {
            periodRenewalDate,
            billingPageLink,
          }
        );
  }

  const {period} = selection.datetime;
  return subscription?.onDemandBudgets?.enabled
    ? tct(
        'You’ve exceeded your [budgetType] budget during this date range and results will be skewed. We can’t collect more spans until [periodRenewalDate]. [rest]',
        {
          budgetType: subscription.planDetails.budgetTerm,
          periodRenewalDate,
          rest: period
            ? tct(
                'If you need more, [billingPageLink: increase your [budgetType] budget] or adjust your date range prior to [formattedDateRange].',
                {
                  billingPageLink,
                  budgetType: subscription.planDetails.budgetTerm,
                  formattedDateRange,
                }
              )
            : tct(
                'If you need more, [billingPageLink: increase your [budgetType] budget] or adjust your date range before or after [formattedDateRange].',
                {
                  billingPageLink,
                  budgetType: subscription.planDetails.budgetTerm,
                  formattedDateRange,
                }
              ),
        }
      )
    : tct(
        'You’ve exceeded your reserved volumes during this date range and results will be skewed. We can’t collect more spans until [periodRenewalDate]. [rest]',
        {
          periodRenewalDate,
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
  referrer: string;
  subscription: Subscription;
};

export function QuotaExceededAlert(props: Props) {
  const organization = useOrganization();
  const message = useQuotaExceededAlertMessage(props.subscription, organization);

  useEffect(() => {
    if (!message) {
      return;
    }

    trackGetsentryAnalytics('performance.quota_exceeded_alert.displayed', {
      organization,
      referrer: props.referrer,
    });
  }, [message, organization, props.referrer]);

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
