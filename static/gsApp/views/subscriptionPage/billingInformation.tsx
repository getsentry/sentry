import type {Location} from 'history';

import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import BillingDetailsPanel from 'getsentry/components/billingDetails/panel';
import CreditCardPanel from 'getsentry/components/creditCardEdit/panel';
import withSubscription from 'getsentry/components/withSubscription';
import {FTCConsentLocation, type Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import RecurringCredits from 'getsentry/views/subscriptionPage/recurringCredits';

import SubscriptionHeader from './subscriptionHeader';

type Props = {
  location: Location;
  organization: Organization;
  subscription: Subscription;
};

/**
 * Update Billing Information view.
 */
function BillingInformation({organization, subscription, location}: Props) {
  const isNewBillingUI = hasNewBillingUI(organization);
  const hasBillingPerms = organization.access?.includes('org:billing');

  if (subscription?.isSelfServePartner) {
    return <Redirect to={`/settings/${organization.slug}/billing/overview/`} />;
  }

  if (!isNewBillingUI) {
    if (!hasBillingPerms) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <ContactBillingMembers />
        </SubscriptionPageContainer>
      );
    }

    if (!subscription) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <LoadingIndicator />
        </SubscriptionPageContainer>
      );
    }

    return (
      <SubscriptionPageContainer background="primary" organization={organization}>
        <SubscriptionHeader organization={organization} subscription={subscription} />
        <RecurringCredits displayType="discount" planDetails={subscription.planDetails} />
        <CreditCardPanel
          organization={organization}
          subscription={subscription}
          location={location}
          isNewBillingUI={isNewBillingUI}
          ftcLocation={FTCConsentLocation.BILLING_DETAILS}
          budgetTerm={subscription.planDetails.budgetTerm}
        />
        <BillingDetailsPanel
          organization={organization}
          subscription={subscription}
          isNewBillingUI={isNewBillingUI}
        />
      </SubscriptionPageContainer>
    );
  }

  return (
    <SubscriptionPageContainer background="primary" organization={organization}>
      <SentryDocumentTitle title={t('Billing Information')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Billing Information')} />
      {hasBillingPerms ? (
        subscription ? (
          <Flex direction="column" gap="xl">
            <CreditCardPanel
              organization={organization}
              subscription={subscription}
              location={location}
              isNewBillingUI={isNewBillingUI}
              ftcLocation={FTCConsentLocation.BILLING_DETAILS}
              budgetTerm={subscription.planDetails.budgetTerm}
              shouldExpandInitially
            />
            <BillingDetailsPanel
              organization={organization}
              subscription={subscription}
              isNewBillingUI={isNewBillingUI}
              shouldExpandInitially
            />
          </Flex>
        ) : (
          <LoadingIndicator />
        )
      ) : (
        <ContactBillingMembers />
      )}
    </SubscriptionPageContainer>
  );
}

export default withSubscription(withOrganization(BillingInformation));

/** @internal exported for tests only */
export {BillingInformation};
