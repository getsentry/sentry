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
  organization: Organization,
  traceItemDataset: TraceItemDatasetGS,
  referrer: string
) {
  const {selection} = usePageFilters();

  let hasExceededExploreItemUsageLimit = false;

  const dataCategories = subscription?.categories;
  if (dataCategories) {
    if (traceItemDataset === 'logs') {
      if ('logBytes' in dataCategories) {
        hasExceededExploreItemUsageLimit =
          dataCategories.logBytes?.usageExceeded || false;
      }
    } else if (traceItemDataset === 'spans') {
      if ('transactions' in dataCategories) {
        hasExceededExploreItemUsageLimit =
          dataCategories.transactions?.usageExceeded || false;
      } else if ('spans' in dataCategories) {
        hasExceededExploreItemUsageLimit = dataCategories.spans?.usageExceeded || false;
      }
    }
  }

  const {data: performanceUsageStats} = usePerformanceUsageStats({
    organization,
    dateRange: selection.datetime,
    projectIds: selection.projects,
  });

  // Check if events were dropped due to exceeding the transaction/spans quota
  const droppedEventsCount = performanceUsageStats?.totals['sum(quantity)'] || 0;

  if (droppedEventsCount === 0 || !hasExceededExploreItemUsageLimit || !subscription) {
    return null;
  }

  const formattedDateRange: string | null = getFormattedDateTime(selection.datetime);
  const billingPageLink = (
    <Link
      to={{
        pathname: `/checkout/?referrer=${referrer}`,
        query: {
          skipBundles: true,
        },
      }}
    />
  );

  const periodRenewalDate = moment(subscription.onDemandPeriodEnd)
    .add(1, 'days')
    .format('ll');

  const datasetType = traceItemDataset;

  if (!formattedDateRange) {
    return subscription?.onDemandBudgets?.enabled
      ? tct(
          "You've exceeded your [budgetType] budget during this date range and results will be skewed. We can’t collect more [datasetType] until [subscriptionRenewalDate]. If you need more, [billingPageLink:increase your [budgetType] budget].",
          {
            budgetType: subscription.planDetails.budgetTerm,
            periodRenewalDate,
            billingPageLink,
            datasetType,
          }
        )
      : tct(
          "You've exceeded your reserved volumes during this date range and results will be skewed. We can’t collect more [datasetType] until [periodRenewalDate]. If you need more, [billingPageLink:increase your reserved volumes].",
          {
            periodRenewalDate,
            billingPageLink,
            datasetType,
          }
        );
  }

  const {period} = selection.datetime;
  return subscription?.onDemandBudgets?.enabled
    ? tct(
        'You’ve exceeded your [budgetType] budget during this date range and results will be skewed. We can’t collect more [datasetType] until [periodRenewalDate]. [rest]',
        {
          budgetType: subscription.planDetails.budgetTerm,
          periodRenewalDate,
          datasetType,
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
        'You’ve exceeded your reserved volumes during this date range and results will be skewed. We can’t collect more [datasetType] until [periodRenewalDate]. [rest]',
        {
          periodRenewalDate,
          datasetType,
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

type TraceItemDatasetGS = 'logs' | 'spans';

type Props = {
  referrer: string;
  subscription: Subscription;
  traceItemDataset: TraceItemDatasetGS;
};

export function QuotaExceededAlert(props: Props) {
  const organization = useOrganization();

  const message = useQuotaExceededAlertMessage(
    props.subscription,
    organization,
    props.traceItemDataset,
    props.referrer
  );

  useEffect(() => {
    if (!message) {
      return;
    }

    trackGetsentryAnalytics('performance.quota_exceeded_alert.displayed', {
      organization,
      referrer: props.referrer,
      traceItemDataset: props.traceItemDataset,
    });
  }, [message, organization, props.referrer, props.traceItemDataset]);

  if (!message) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert type="warning">{message}</Alert>
    </Alert.Container>
  );
}

export default withSubscription(QuotaExceededAlert, {noLoader: true});
