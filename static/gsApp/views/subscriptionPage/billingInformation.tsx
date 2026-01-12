import {useTheme} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import BillingDetailsPanel from 'getsentry/components/billingDetails/panel';
import CreditCardPanel from 'getsentry/components/creditCardEdit/panel';
import withSubscription from 'getsentry/components/withSubscription';
import {FTCConsentLocation, type Subscription} from 'getsentry/types';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

type Props = {
  subscription: Subscription;
};

/**
 * Update Billing Information view.
 */
function BillingInformation({subscription}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const hasBillingPerms = organization.access?.includes('org:billing');
  const theme = useTheme();
  const maxPanelWidth = theme.breakpoints.lg;

  if (subscription?.isSelfServePartner) {
    return <Redirect to={`/settings/${organization.slug}/billing/overview/`} />;
  }

  return (
    <SubscriptionPageContainer background="primary">
      <SentryDocumentTitle title={t('Billing Information')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Billing Information')} />
      {hasBillingPerms ? (
        subscription ? (
          <Flex direction="column" gap="xl">
            <CreditCardPanel
              organization={organization}
              subscription={subscription}
              location={location}
              ftcLocation={FTCConsentLocation.BILLING_DETAILS}
              budgetTerm={subscription.planDetails.budgetTerm}
              shouldExpandInitially
              maxPanelWidth={maxPanelWidth}
            />
            <BillingDetailsPanel
              organization={organization}
              subscription={subscription}
              shouldExpandInitially
              maxPanelWidth={maxPanelWidth}
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

export default withSubscription(BillingInformation);

/** @internal exported for tests only */
export {BillingInformation};
