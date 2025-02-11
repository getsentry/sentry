import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import {openCodecovModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {
  BillingStatTotal,
  CustomerUsage,
  Plan,
  ProductTrial,
  PromotionData,
  Subscription,
} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {hasAccessToSubscriptionOverview} from 'getsentry/utils/billing';
import {sortCategories} from 'getsentry/utils/dataCategory';
import withPromotions from 'getsentry/utils/withPromotions';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';

import openPerformanceQuotaCreditsPromoModal from './promotions/performanceQuotaCreditsPromo';
import openPerformanceReservedTransactionsDiscountModal from './promotions/performanceReservedTransactionsPromo';
import TrialEnded from './trial/trialEnded';
import OnDemandDisabled from './ondemandDisabled';
import {OnDemandSettings} from './onDemandSettings';
import {DisplayModeToggle} from './overviewDisplayModeToggle';
import RecurringCredits from './recurringCredits';
import ReservedUsageChart from './reservedUsageChart';
import SubscriptionHeader from './subscriptionHeader';
import UsageAlert from './usageAlert';
import UsageTotals from './usageTotals';
import {trackSubscriptionView} from './utils';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  promotionData: PromotionData;
  subscription: Subscription;
};

/**
 * Subscription overview page.
 */
function Overview({api, location, subscription, organization, promotionData}: Props) {
  const displayMode = ['cost', 'usage'].includes(location.query.displayMode as string)
    ? (location.query.displayMode as 'cost' | 'usage')
    : 'usage';
  const hasBillingPerms = organization.access?.includes('org:billing');
  // we fetch an expanded view of the subscription which includes usage
  // data for the current period
  const {
    data: usage,
    refetch: refetchUsage,
    isPending,
    isError,
  } = useApiQuery<CustomerUsage>([`/customers/${organization.slug}/usage/`], {
    staleTime: 60_000,
  });

  useEffect(() => {
    if (promotionData) {
      let promotion = promotionData.availablePromotions?.find(
        promo => promo.promptActivityTrigger === 'performance_reserved_txns_discount_v1'
      );

      if (promotion) {
        openPerformanceReservedTransactionsDiscountModal({
          api,
          promotionData,
          organization,
          promptFeature: 'performance_reserved_txns_discount_v1',
        });
        return;
      }

      promotion = promotionData.availablePromotions?.find(
        promo => promo.promptActivityTrigger === 'performance_quota_credits_v1'
      );

      if (promotion) {
        openPerformanceQuotaCreditsPromoModal({api, promotionData, organization});
        return;
      }

      promotion = promotionData.availablePromotions?.find(
        promo => promo.promptActivityTrigger === 'performance_reserved_txns_discount'
      );

      if (promotion) {
        openPerformanceReservedTransactionsDiscountModal({
          api,
          promotionData,
          organization,
          promptFeature: 'performance_reserved_txns_discount',
        });
        return;
      }
    }

    // open the codecov modal if the query param is present
    if (
      location.query?.open_codecov_modal === '1' &&
      // self serve or has billing perms can view it
      hasAccessToSubscriptionOverview(subscription, organization)
    ) {
      openCodecovModal({organization});
    }
  }, [organization, location.query, subscription, promotionData, api]);

  useEffect(
    () => void trackSubscriptionView(organization, subscription, 'overview'),
    [subscription, organization]
  );

  // Sales managed accounts do not allow members to view the billing page.
  // Whilst self-serve accounts do.
  if (!hasBillingPerms && !subscription.canSelfServe) {
    return <ContactBillingMembers />;
  }

  function renderUsageChart(usageData: CustomerUsage) {
    const {stats, periodStart, periodEnd} = usageData;

    return (
      <ErrorBoundary mini>
        <ReservedUsageChart
          location={location}
          organization={organization}
          subscription={subscription}
          usagePeriodStart={periodStart}
          usagePeriodEnd={periodEnd}
          usageStats={stats}
          displayMode={displayMode}
        />
      </ErrorBoundary>
    );
  }

  function renderUsageCards(usageData: CustomerUsage) {
    const nonPlanProductTrials: ProductTrial[] =
      subscription.productTrials?.filter(
        pt => !Object.keys(subscription.categories).includes(pt.category)
      ) || [];
    const showProductTrialEventBreakdown: boolean =
      nonPlanProductTrials?.filter(pt => pt.category === DataCategory.PROFILES).length >
        0 || false;

    return (
      <TotalsWrapper>
        {sortCategories(subscription.categories).map(categoryHistory => {
          const category = categoryHistory.category;
          if (
            category === DATA_CATEGORY_INFO.spanIndexed.plural &&
            !subscription.hadCustomDynamicSampling
          ) {
            return null;
          }

          // The usageData does not include details for seat-based categories.
          // For now we will handle the monitor category specially

          let monitor_usage: number | undefined = 0;
          if (category === DataCategory.MONITOR_SEATS) {
            monitor_usage = subscription.categories.monitorSeats?.usage;
          }
          if (category === DataCategory.UPTIME) {
            monitor_usage = subscription.categories.uptime?.usage;
          }

          const categoryTotals: BillingStatTotal =
            category !== DataCategory.MONITOR_SEATS && category !== DataCategory.UPTIME
              ? usageData.totals[category]!
              : {
                  accepted: monitor_usage ?? 0,
                  dropped: 0,
                  droppedOther: 0,
                  droppedOverQuota: 0,
                  droppedSpikeProtection: 0,
                  filtered: 0,
                  projected: 0,
                };

          const eventTotals =
            category !== DataCategory.MONITOR_SEATS && category !== DataCategory.UPTIME
              ? usageData.eventTotals?.[category]
              : undefined;

          const showEventBreakdown =
            organization.features.includes('profiling-billing') &&
            subscription.planTier === PlanTier.AM2;

          return (
            <UsageTotals
              key={category}
              category={category}
              totals={categoryTotals}
              eventTotals={eventTotals}
              showEventBreakdown={showEventBreakdown}
              reserved={categoryHistory.reserved}
              prepaid={categoryHistory.prepaid}
              free={categoryHistory.free}
              trueForward={categoryHistory.trueForward}
              softCapType={categoryHistory.softCapType}
              disableTable={
                category === DataCategory.MONITOR_SEATS ||
                category === DataCategory.UPTIME ||
                displayMode === 'cost'
              }
              subscription={subscription}
              organization={organization}
              displayMode={displayMode}
            />
          );
        })}

        {nonPlanProductTrials?.map(pt => {
          const categoryTotals = usageData.totals[pt.category];
          const eventTotals = usageData.eventTotals?.[pt.category];

          return (
            <UsageTotals
              key={pt.category}
              category={pt.category}
              totals={categoryTotals}
              eventTotals={eventTotals}
              showEventBreakdown={showProductTrialEventBreakdown}
              subscription={subscription}
              organization={organization}
              displayMode={displayMode}
            />
          );
        })}
      </TotalsWrapper>
    );
  }

  if (isPending) {
    return (
      <Fragment>
        <SubscriptionHeader subscription={subscription} organization={organization} />
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetchUsage} />;
  }

  /**
   * It's important to separate the views for folks with billing permissions (org:billing) and those without.
   * Only owners and billing admins have the billing scope, everyone else including managers, admins, and members lack that scope.
   *
   * Non-billing users should be able to see the following info:
   *   - Current Plan information and the date when it ends
   *   - Event totals, dropped events, usage charts
   *   - Alerts for overages (usage alert, grace period, etc)
   *   - CTAs asking the user to request a plan change
   *
   * Non-billing users should NOT see any of the following:
   *   - Anything with a dollar amount
   *   - Receipts
   *   - Credit card on file
   *   - Previous usage history
   *   - On-demand information
   */
  function contentWithBillingPerms(usageData: CustomerUsage, planDetails: Plan) {
    return (
      <Fragment>
        <RecurringCredits displayType="discount" planDetails={planDetails} />
        <RecurringCredits displayType="data" planDetails={planDetails} />
        <OnDemandDisabled subscription={subscription} />
        <UsageAlert subscription={subscription} usage={usageData} />
        <DisplayModeToggle subscription={subscription} displayMode={displayMode} />
        {renderUsageChart(usageData)}
        {renderUsageCards(usageData)}
        <OnDemandSettings organization={organization} subscription={subscription} />
        <TrialEnded subscription={subscription} />
      </Fragment>
    );
  }

  function contentWithoutBillingPerms(usageData: CustomerUsage) {
    return (
      <Fragment>
        <OnDemandDisabled subscription={subscription} />
        <UsageAlert subscription={subscription} usage={usageData} />
        {renderUsageChart(usageData)}
        {renderUsageCards(usageData)}
        <TrialEnded subscription={subscription} />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <SubscriptionHeader organization={organization} subscription={subscription} />
      <div>
        {hasBillingPerms
          ? contentWithBillingPerms(usage, subscription.planDetails)
          : contentWithoutBillingPerms(usage)}
      </div>
    </Fragment>
  );
}

export default withApi(withOrganization(withSubscription(withPromotions(Overview))));

const TotalsWrapper = styled('div')`
  margin-bottom: ${space(3)};
`;
