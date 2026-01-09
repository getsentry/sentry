import {Fragment, useEffect} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {
  openCodecovModal,
  openOnDemandBudgetEditModal,
} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {
  CustomerUsage,
  Plan,
  PromotionData,
  ReservedBudgetForCategory,
  Subscription,
} from 'getsentry/types';
import {hasAccessToSubscriptionOverview} from 'getsentry/utils/billing';
import withPromotions from 'getsentry/utils/withPromotions';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import UsageOverview from 'getsentry/views/subscriptionPage/usageOverview';

import openPerformanceReservedTransactionsDiscountModal from './promotions/performanceReservedTransactionsPromo';
import TrialEnded from './trial/trialEnded';
import OnDemandDisabled from './ondemandDisabled';
import RecurringCredits from './recurringCredits';
import SubscriptionHeader from './subscriptionHeader';
import UsageAlert from './usageAlert';

type Props = {
  promotionData: PromotionData;
  subscription: Subscription;
};

/**
 * Subscription overview page.
 */
function Overview({subscription, promotionData}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

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
      const promotion = promotionData.availablePromotions?.find(
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
    if (window.location.hash === '#open-ondemand-modal') {
      openOnDemandBudgetEditModal({organization, subscription});

      // Clear hash to prevent modal reopening on refresh
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }
  }, [organization, location.query, subscription, promotionData, api, navigate]);

  // Sales managed accounts do not allow members to view the billing page.
  // Whilst self-serve accounts do.
  if (!hasBillingPerms && !subscription.canSelfServe) {
    return (
      <SubscriptionPageContainer background="primary">
        <ContactBillingMembers />
      </SubscriptionPageContainer>
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
        padding="xl 0"
        background="primary"
        borderTop="primary"
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
   *   - On-demand/PAYG information
   */
  function contentWithBillingPerms(usageData: CustomerUsage, planDetails: Plan) {
    return (
      <Fragment>
        <RecurringCredits displayType="discount" planDetails={planDetails} />
        <RecurringCredits displayType="data" planDetails={planDetails} />
        <OnDemandDisabled organization={organization} subscription={subscription} />
        <UsageAlert subscription={subscription} usage={usageData} />
        <UsageOverview
          subscription={subscription}
          organization={organization}
          usageData={usageData}
        />

        <TrialEnded subscription={subscription} />
        {renderFooter()}
      </Fragment>
    );
  }

  function contentWithoutBillingPerms(usageData: CustomerUsage) {
    return (
      <Fragment>
        <OnDemandDisabled organization={organization} subscription={subscription} />
        <UsageAlert subscription={subscription} usage={usageData} />
        <UsageOverview
          subscription={subscription}
          organization={organization}
          usageData={usageData}
        />

        <TrialEnded subscription={subscription} />
        {renderFooter()}
      </Fragment>
    );
  }

  return (
    <SubscriptionPageContainer
      background="primary"
      header={
        <SubscriptionHeader organization={organization} subscription={subscription} />
      }
      useBorderTopLogic={false}
      paddingOverride="0 2xl 3xl"
    >
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError onRetry={refetchUsage} />
      ) : (
        <Flex direction="column" gap="xl" paddingTop="xl">
          {hasBillingPerms
            ? contentWithBillingPerms(usage, subscription.planDetails)
            : contentWithoutBillingPerms(usage)}
        </Flex>
      )}
    </SubscriptionPageContainer>
  );
}

export default withSubscription(withPromotions(Overview));
