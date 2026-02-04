import {Fragment, useEffect} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {openOnDemandBudgetEditModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {CustomerUsage, Subscription} from 'getsentry/types';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import UsageOverview from 'getsentry/views/subscriptionPage/usageOverview';

import TrialEnded from './trial/trialEnded';
import OnDemandDisabled from './ondemandDisabled';
import RecurringCredits from './recurringCredits';
import SubscriptionHeader from './subscriptionHeader';
import UsageAlert from './usageAlert';

type Props = {
  subscription: Subscription;
};

/**
 * Subscription overview page.
 */
function Overview({subscription}: Props) {
  const organization = useOrganization();

  const hasBillingPerms = organization.access?.includes('org:billing');
  // we fetch an expanded view of the subscription which includes usage
  // data for the current period
  const {
    data: usage,
    refetch: refetchUsage,
    isPending,
    isError,
  } = useApiQuery<CustomerUsage>(
    [
      getApiUrl(`/customers/$organizationIdOrSlug/usage/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 60_000,
    }
  );

  useEffect(() => {
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
  }, [organization, subscription]);

  // Sales managed accounts do not allow members to view the billing page.
  // Whilst self-serve accounts do.
  if (!hasBillingPerms && !subscription.canSelfServe) {
    return (
      <SubscriptionPageContainer background="primary">
        <ContactBillingMembers />
      </SubscriptionPageContainer>
    );
  }

  return (
    <Fragment>
      <SubscriptionHeader organization={organization} subscription={subscription} />
      <SubscriptionPageContainer background="primary" padding="0 2xl 3xl">
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError onRetry={refetchUsage} />
        ) : (
          <Flex direction="column" gap="xl" paddingTop="xl">
            {/**
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
             */}
            {hasBillingPerms ? (
              <Fragment>
                <RecurringCredits
                  displayType="discount"
                  planDetails={subscription.planDetails}
                />
                <RecurringCredits
                  displayType="data"
                  planDetails={subscription.planDetails}
                />
              </Fragment>
            ) : null}
            <OnDemandDisabled organization={organization} subscription={subscription} />
            <UsageAlert subscription={subscription} usage={usage} />
            <UsageOverview
              subscription={subscription}
              organization={organization}
              usageData={usage}
            />
            <TrialEnded subscription={subscription} />
            <Footer subscription={subscription} />
          </Flex>
        )}
      </SubscriptionPageContainer>
    </Fragment>
  );
}

function Footer({subscription}: {subscription: Subscription}) {
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

export default withSubscription(Overview);
