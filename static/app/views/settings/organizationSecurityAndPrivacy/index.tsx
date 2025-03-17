import {Fragment, useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import organizationSecurityAndPrivacyGroups from 'sentry/data/forms/organizationSecurityAndPrivacyGroups';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {AuthProvider} from 'sentry/types/auth';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import DataSecrecy from 'sentry/views/settings/components/dataSecrecy/index';
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

  const {isSelfHosted} = ConfigStore.getState();
  // only need data secrecy in saas
  const showDataSecrecySettings =
    organization.features.includes('data-secrecy') && !isSelfHosted;

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
          additionalFieldProps={{showDataSecrecySettings}}
        />
      </Form>

      {showDataSecrecySettings && <DataSecrecy />}

      <DataScrubbing
        additionalContext={t(
          'Advanced data scrubbing rules can be configured at the organization level and will apply to all projects. Project-level rules can be configured in addition to organization-level rules.'
        )}
        endpoint={endpoint}
        relayPiiConfig={relayPiiConfig}
        organization={organization}
        disabled={!organization.access.includes('org:write')}
        onSubmitSuccess={data => handleUpdateOrganization({...organization, ...data})}
      />
    </Fragment>
  );
}
