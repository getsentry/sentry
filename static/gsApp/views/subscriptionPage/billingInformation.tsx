import {useEffect} from 'react';
import type {Location} from 'history';

import {Container, Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import BillingDetailsPanel from 'getsentry/components/billingDetails/panel';
import CreditCardPanel from 'getsentry/components/creditCardEdit/panel';
import withSubscription from 'getsentry/components/withSubscription';
import {FTCConsentLocation, type Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import RecurringCredits from 'getsentry/views/subscriptionPage/recurringCredits';

import SubscriptionHeader from './subscriptionHeader';
import {trackSubscriptionView} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  subscription: Subscription;
};

/**
 * Update Billing Information view.
 */
function BillingInformation({organization, subscription, location}: Props) {
  useEffect(() => {
    if (!organization || !subscription) return;

    trackSubscriptionView(organization, subscription, 'details');
  }, [organization, subscription]);

  const hasBillingPerms = organization.access?.includes('org:billing');
  if (!hasBillingPerms) {
    return <ContactBillingMembers />;
  }

  if (!subscription) {
    return <LoadingIndicator />;
  }

  const isNewBillingUI = hasNewBillingUI(organization);

  if (!isNewBillingUI) {
    return (
      <Container>
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
      </Container>
    );
  }

  return (
    <Container>
      <SubscriptionHeader organization={organization} subscription={subscription} />
      <RecurringCredits displayType="discount" planDetails={subscription.planDetails} />
      <Flex direction="column" gap="xl">
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
      </Flex>
    </Container>
  );
}

export default withSubscription(withOrganization(BillingInformation));

/** @internal exported for tests only */
export {BillingInformation};
