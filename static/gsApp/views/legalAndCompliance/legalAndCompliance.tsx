import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationRegionAction} from 'sentry/views/settings/organizationGeneralSettings/organizationRegionAction';

import useSubscription from 'getsentry/hooks/useSubscription';
import {GDPRPanel} from 'getsentry/views/legalAndCompliance/gdprPanel';
import {TermsAndConditions} from 'getsentry/views/legalAndCompliance/termsAndConditions';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

export default function LegalAndCompliance() {
  const organization = useOrganization();
  const subscription = useSubscription();

  if (!subscription) {
    return <LoadingIndicator />;
  }

  return (
    <SubscriptionPageContainer background="secondary">
      <SentryDocumentTitle title={t('Legal & Compliance')} />
      <SettingsPageHeader
        title="Legal & Compliance"
        action={OrganizationRegionAction({organization})}
      />
      <TermsAndConditions subscription={subscription} />
      <GDPRPanel subscription={subscription} />
    </SubscriptionPageContainer>
  );
}
