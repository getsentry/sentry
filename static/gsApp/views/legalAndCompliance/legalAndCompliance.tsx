import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationRegionAction} from 'sentry/views/settings/organizationGeneralSettings/organizationRegionAction';

import BillingDetailsPanel from 'getsentry/components/billingDetails/panel';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import {GDPRPanel} from 'getsentry/views/legalAndCompliance/gdprPanel';
import {TermsAndConditions} from 'getsentry/views/legalAndCompliance/termsAndConditions';

type Props = RouteComponentProps<unknown, unknown> & {
  organization: Organization;
  subscription: Subscription;
};

function LegalAndCompliance(props: Props) {
  const isNewBillingUI = hasNewBillingUI(props.organization);
  return (
    <div>
      <SentryDocumentTitle title={t('Legal & Compliance')} />
      <SettingsPageHeader
        title="Legal & Compliance"
        action={OrganizationRegionAction({organization: props.organization})}
      />
      <TermsAndConditions {...props} />
      <GDPRPanel subscription={props.subscription} />
      <BillingDetailsPanel
        organization={props.organization}
        subscription={props.subscription}
        title={t('Company Details')}
        isNewBillingUI={isNewBillingUI}
        analyticsEvent="legal_and_compliance.updated_billing_details"
      />
    </div>
  );
}

export default withOrganization(withSubscription(LegalAndCompliance));
