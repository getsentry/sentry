import {useTheme} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {BillingDetailsPanel} from 'getsentry/components/billingDetails/panel';
import {CreditCardPanel} from 'getsentry/components/creditCardEdit/panel';
import {SubscriptionLoadingFallback} from 'getsentry/components/subscriptionLoadingFallback';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {FTCConsentLocation} from 'getsentry/types';
import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

/**
 * Update Billing Information view.
 */
function BillingInformation() {
  const organization = useOrganization();
  const subscription = useSubscription();
  const location = useLocation();
  const hasBillingPerms = organization.access?.includes('org:billing');
  const theme = useTheme();
  const maxPanelWidth = theme.breakpoints.lg;

  if (!subscription) {
    return <SubscriptionLoadingFallback />;
  }

  if (subscription.isSelfServePartner) {
    return <Redirect to={`/settings/${organization.slug}/billing/overview/`} />;
  }

  // The customer endpoint returns 200 with an empty body when it cannot
  // serialize the customer, so the subscription has no plan details.
  if (!subscription.planDetails) {
    return (
      <SubscriptionPageContainer>
        <SentryDocumentTitle
          title={t('Billing Information')}
          orgSlug={organization.slug}
        />
        <SettingsPageHeader title={t('Billing Information')} />
        <LoadingError
          onRetry={() => {
            SubscriptionStore.loadData(organization.slug);
          }}
        />
      </SubscriptionPageContainer>
    );
  }

  return (
    <SubscriptionPageContainer>
      <SentryDocumentTitle title={t('Billing Information')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Billing Information')} />
      {hasBillingPerms ? (
        <Stack gap="xl">
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
        </Stack>
      ) : (
        <ContactBillingMembers />
      )}
    </SubscriptionPageContainer>
  );
}

export default BillingInformation;
