import {Fragment, useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import organizationSecurityAndPrivacyGroups from 'sentry/data/forms/organizationSecurityAndPrivacyGroups';
import {t} from 'sentry/locale';
import {AuthProvider, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {DataScrubbing} from '../components/dataScrubbing';

export default function OrganizationSecurityAndPrivacyContent() {
  const api = useApi();
  const organization = useOrganization();
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(null);

  useEffect(() => {
    async function fetchAuthProvider() {
      try {
        const response: AuthProvider = await api.requestPromise(
          `/organizations/${organization.slug}/auth-provider/`
        );
        setAuthProvider(response);
      } catch {
        addErrorMessage(t('Unable to fetch authentication provider'));
      }
    }

    fetchAuthProvider();
  }, [organization.slug, api]);

  const initialData = organization;
  const endpoint = `/organizations/${organization.slug}/`;
  const features = new Set(organization.features);
  const relayPiiConfig = organization.relayPiiConfig;
  const title = t('Security & Privacy');

  function handleUpdateOrganization(data: Organization) {
    // This will update OrganizationStore (as well as OrganizationsStore
    // which is slightly incorrect because it has summaries vs a detailed org)
    updateOrganization(data);
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <SettingsPageHeader title={title} />
      <Form
        data-test-id="organization-settings-security-and-privacy"
        apiMethod="PUT"
        apiEndpoint={endpoint}
        initialData={initialData}
        additionalFieldProps={{hasSsoEnabled: !!authProvider}}
        onSubmitSuccess={handleUpdateOrganization}
        onSubmitError={() => addErrorMessage(t('Unable to save change'))}
        saveOnBlur
        allowUndo
      >
        <JsonForm
          features={features}
          forms={organizationSecurityAndPrivacyGroups}
          disabled={!organization.access.includes('org:write')}
        />
      </Form>
      <DataScrubbing
        additionalContext={t('These rules can be configured for each project.')}
        endpoint={endpoint}
        relayPiiConfig={relayPiiConfig}
        organization={organization}
        disabled={!organization.access.includes('org:write')}
        onSubmitSuccess={data => handleUpdateOrganization({...organization, ...data})}
      />
    </Fragment>
  );
}
