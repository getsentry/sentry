import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationRegionAction} from 'sentry/views/settings/organizationGeneralSettings/organizationRegionAction';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {GDPRPanel} from 'getsentry/views/legalAndCompliance/gdprPanel';
import {TermsAndConditions} from 'getsentry/views/legalAndCompliance/termsAndConditions';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

type Props = RouteComponentProps<unknown, unknown> & {
  organization: Organization;
  subscription: Subscription;
};

function LegalAndCompliance(props: Props) {
  return (
    <SubscriptionPageContainer background="secondary">
      <SentryDocumentTitle title={t('Legal & Compliance')} />
      <SettingsPageHeader
        title="Legal & Compliance"
        action={OrganizationRegionAction({organization: props.organization})}
      />
      <TermsAndConditions {...props} />
      <GDPRPanel subscription={props.subscription} />
    </SubscriptionPageContainer>
  );
}

export default withOrganization(withSubscription(LegalAndCompliance));
