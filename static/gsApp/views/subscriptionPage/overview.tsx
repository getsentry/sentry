import {Fragment, useEffect} from 'react';
import type {Location} from 'history';

import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {openCodecovModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {
  BillingStatTotal,
  CustomerUsage,
  Plan,
  ProductTrial,
  PromotionData,
  ReservedBudgetForCategory,
  Subscription,
} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {hasAccessToSubscriptionOverview, hasNewBillingUI} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  isPartOfReservedBudget,
  sortCategories,
} from 'getsentry/utils/dataCategory';
import withPromotions from 'getsentry/utils/withPromotions';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import UsageOverview from 'getsentry/views/subscriptionPage/usageOverview';

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
import {CombinedUsageTotals, UsageTotals} from './usageTotals';

type Props = {
  location: Location;
  promotionData: PromotionData;
  subscription: Subscription;
};

/**
 * Subscription overview page.
 */
function Overview({location, subscription, promotionData}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const isNewBillingUI = hasNewBillingUI(organization);
  const navigate = useNavigate();

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

  const reservedBudgetCategoryInfo: Record<string, ReservedBudgetForCategory> = {};
  subscription.reservedBudgets?.forEach(rb => {
    Object.entries(rb.categories).forEach(([category, rbmh]) => {
      reservedBudgetCategoryInfo[category] = {
        freeBudget: rb.freeBudget,
        totalReservedBudget: rb.reservedBudget,
        reservedSpend: rbmh.reservedSpend,
        reservedCpe: rbmh.reservedCpe,
        prepaidBudget: rb.reservedBudget + rb.freeBudget,
        apiName: rb.apiName,
      };
    });
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
          navigate,
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
    }

    // open the codecov modal if the query param is present
    if (
      location.query?.open_codecov_modal === '1' &&
      // self serve or has billing perms can view it
      hasAccessToSubscriptionOverview(subscription, organization)
    ) {
      openCodecovModal({organization});
    }

    // Open on-demand budget modal if hash fragment present
    // Modal logic handles checking perms
    if (window.location.hash === '#open-ondemand-modal' && !isNewBillingUI) {
      openOnDemandBudgetEditModal({organization, subscription});

      // Clear hash to prevent modal reopening on refresh
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }
  }, [
    organization,
    location.query,
    subscription,
    promotionData,
    api,
    navigate,
    isNewBillingUI,
  ]);

  // Sales managed accounts do not allow members to view the billing page.
  // Whilst self-serve accounts do.
  if (!hasBillingPerms && !subscription.canSelfServe) {
    return (
      <SubscriptionPageContainer background="secondary" organization={organization}>
        <ContactBillingMembers />
      </SubscriptionPageContainer>
    );
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
          reservedBudgetCategoryInfo={reservedBudgetCategoryInfo}
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
      <Fragment>
        {sortCategories(subscription.categories)
          .filter(
            categoryHistory =>
              !isPartOfReservedBudget(
                categoryHistory.category,
                subscription.reservedBudgets ?? []
              )
          )
          .map(categoryHistory => {
            const category = categoryHistory.category;
            const categoryInfo = getCategoryInfoFromPlural(category);

            // The usageData does not include details for seat-based categories
            let monitor_usage: number | undefined = 0;
            if (categoryInfo?.tallyType === 'seat') {
              monitor_usage = subscription.categories[category]?.usage;
            }

            if (
              category === DataCategory.SPANS_INDEXED &&
              !subscription.hadCustomDynamicSampling
            ) {
              return null; // TODO(trial limits): DS enterprise trial should have a reserved budget too, but currently just has unlimited
            }

            const categoryTotals: BillingStatTotal =
              categoryInfo?.tallyType === 'usage'
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
              categoryInfo?.tallyType === 'usage'
                ? usageData.eventTotals?.[category]
                : undefined;

            const showEventBreakdown =
              organization.features.includes('profiling-billing') &&
              subscription.planTier === PlanTier.AM2 &&
              category === DataCategory.TRANSACTIONS;

            return (
              <UsageTotals
                key={category}
                category={category}
                totals={categoryTotals}
                eventTotals={eventTotals}
                showEventBreakdown={showEventBreakdown}
                reservedUnits={categoryHistory.reserved}
                prepaidUnits={categoryHistory.prepaid}
                freeUnits={categoryHistory.free}
                trueForward={categoryHistory.trueForward}
                softCapType={categoryHistory.softCapType}
                disableTable={
                  categoryInfo?.tallyType === 'seat' || displayMode === 'cost'
                }
                subscription={subscription}
                organization={organization}
                displayMode={displayMode}
              />
            );
          })}

        {subscription.reservedBudgets?.map(reservedBudget => {
          let softCapType: 'ON_DEMAND' | 'TRUE_FORWARD' | null = null;
          let trueForward = false;

          Object.keys(reservedBudget.categories).forEach(category => {
            const categoryHistory = subscription.categories[category as DataCategory];
            if (softCapType === null) {
              if (categoryHistory?.softCapType) {
                softCapType = categoryHistory.softCapType;
              }
            }
            if (!trueForward) {
              if (categoryHistory?.trueForward) {
                trueForward = categoryHistory.trueForward;
              }
            }
          });

          return (
            <CombinedUsageTotals
              key={reservedBudget.apiName}
              subscription={subscription}
              organization={organization}
              productGroup={reservedBudget}
              allTotalsByCategory={usageData.totals}
              softCapType={softCapType}
              trueForward={trueForward}
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
      </Fragment>
    );
  }

  function renderFooter() {
    if (!subscription.canSelfServe) {
      return null;
    }
    return (
      <Flex
        direction="column"
        gap="sm"
        padding="xl"
        background="primary"
        radius="md"
        border="primary"
      >
        <Flex align="center" gap="sm">
          <Text bold>{t('Having trouble?')}</Text>
        </Flex>
        <Text>
          {tct('Reach out to our [supportLink], or join us on [discordLink]', {
            supportLink: (
              <ExternalLink href="https://support.sentry.io">
                {t('Support team')}
              </ExternalLink>
            ),
            discordLink: (
              <ExternalLink href="https://discord.com/invite/sentry">
                {t('Discord')}
              </ExternalLink>
            ),
          })}
        </Text>
      </Flex>
    );
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
        {isNewBillingUI ? (
          <UsageOverview
            subscription={subscription}
            organization={organization}
            usageData={usageData}
          />
        ) : (
          <Fragment>
            <DisplayModeToggle
              subscription={subscription}
              displayMode={displayMode}
              organization={organization}
            />
            {renderUsageChart(usageData)}
            {renderUsageCards(usageData)}
            <OnDemandSettings organization={organization} subscription={subscription} />
          </Fragment>
        )}
        <TrialEnded subscription={subscription} />
        {renderFooter()}
      </Fragment>
    );
  }

  function contentWithoutBillingPerms(usageData: CustomerUsage) {
    return (
      <Fragment>
        <OnDemandDisabled subscription={subscription} />
        <UsageAlert subscription={subscription} usage={usageData} />
        {isNewBillingUI ? (
          <UsageOverview
            subscription={subscription}
            organization={organization}
            usageData={usageData}
          />
        ) : (
          <Fragment>
            {renderUsageChart(usageData)}
            {renderUsageCards(usageData)}
          </Fragment>
        )}
        <TrialEnded subscription={subscription} />
        {renderFooter()}
      </Fragment>
    );
  }

  return (
    <SubscriptionPageContainer
      background="secondary"
      organization={organization}
      header={
        isNewBillingUI ? (
          <SubscriptionHeader organization={organization} subscription={subscription} />
        ) : undefined
      }
      useBorderTopLogic={false}
      paddingOverride="0 2xl 3xl"
    >
      {!isNewBillingUI && (
        <SubscriptionHeader organization={organization} subscription={subscription} />
      )}
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError onRetry={refetchUsage} />
      ) : (
        <Flex direction="column" gap="xl">
          {hasBillingPerms
            ? contentWithBillingPerms(usage, subscription.planDetails)
            : contentWithoutBillingPerms(usage)}
        </Flex>
      )}
    </SubscriptionPageContainer>
  );
}

export default withSubscription(withPromotions(Overview));
