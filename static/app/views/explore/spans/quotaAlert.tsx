import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {usePerformanceSubscriptionDetails} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/usePerformanceSubscriptionDetails';
import {usePerformanceUsageStats} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/usePerformanceUsageStats';

function dateFormatter(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

// Returns the beggining of statsPeriod fomatted like "Jan 1, 2022"
// or absolute date range formatted like "Jan 1, 2022 - Jan 2, 2022"
function getFormattedDateTime({
  statsPeriod,
  start,
  end,
}: {
  end: string | undefined;
  start: string | undefined;
  statsPeriod: string | null | undefined;
}): string | null {
  if (statsPeriod) {
    const periodToHours = parsePeriodToHours(statsPeriod);
    const periodStartDate = new Date(Date.now() - periodToHours * 60 * 60 * 1000);
    return dateFormatter(periodStartDate);
  }

  if (start && end) {
    return `${dateFormatter(new Date(start))} - ${dateFormatter(new Date(end))}`;
  }

  return null;
}

function useQuotaExceededAlertMessage() {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {start, end, statsPeriod} = normalizeDateTimeParams(location.query);

  const {data: performanceUsageStats} = usePerformanceUsageStats({
    organization,
    dateRange: statsPeriod ? {statsPeriod} : {start, end},
    projectIds: selection.projects,
  });

  // Check if events were dropped due to exceeding the transaction/spans quota
  const droppedEventsCount = performanceUsageStats?.totals['sum(quantity)'] || 0;

  const {
    data: {hasExceededPerformanceUsageLimit, subscription},
  } = usePerformanceSubscriptionDetails();

  if (droppedEventsCount === 0 || !hasExceededPerformanceUsageLimit || !subscription) {
    return null;
  }

  const budgetType = subscription?.onDemandBudgets?.enabled
    ? ['am1', 'am2'].includes(subscription.planTier)
      ? t('on-demand budget')
      : t('pay-as-you-go budget')
    : t('reserved volumes');
  const formattedDateRange: string | null = getFormattedDateTime({
    statsPeriod,
    start,
    end,
  });
  const billingPageLink = (
    <Link
      to={{
        pathname: `/settings/billing/checkout/?referrer=trace-view`,
        query: {
          skipBundles: true,
        },
      }}
    >
      {tct('increase your [budgetType]', {budgetType})}
    </Link>
  );

  const subscriptionRenewalDate = dateFormatter(new Date(subscription.renewalDate));

  if (!formattedDateRange) {
    return tct(
      'You’ve exceeded your [budgetType] during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. If you need more, [billingPageLink]',
      {
        subscriptionRenewalDate,
        billingPageLink,
        budgetType,
      }
    );
  }

  return tct(
    'You’ve exceeded your [budgetType] during this date range and results will be skewed. We can’t collect more spans until [subscriptionRenewalDate]. [rest]',
    {
      budgetType,
      subscriptionRenewalDate,
      rest: statsPeriod
        ? tct(
            'If you need more, [billingPageLink] or adjust your date range prior to [formattedDateRange].',
            {
              billingPageLink,
              formattedDateRange,
            }
          )
        : tct(
            'If you need more, [billingPageLink] or adjust your date range before or after [formattedDateRange].',
            {
              billingPageLink,
              formattedDateRange,
            }
          ),
    }
  );
}

export function QuotaExceededAlert() {
  const message = useQuotaExceededAlertMessage();

  if (!message) {
    return null;
  }

  return (
    <StyledAlert type="warning" showIcon>
      {message}
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;
