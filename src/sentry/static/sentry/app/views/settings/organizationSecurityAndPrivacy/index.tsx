import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Form from 'app/views/settings/components/forms/form';
import AsyncView from 'app/views/asyncView';
import {Organization} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {updateOrganization} from 'app/actionCreators/organizations';
import organizationSecurityAndPrivacyGroups from 'app/data/forms/organizationSecurityAndPrivacyGroups';
import withOrganization from 'app/utils/withOrganization';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';

import DataScrubbing from '../components/dataScrubbing';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
};

class OrganizationSecurityAndPrivacyContent extends AsyncView<Props> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;
    return [['authProvider', `/organizations/${orgId}/auth-provider/`]];
  }

  handleUpdateOrganization = (data: Organization) => {
    // This will update OrganizationStore (as well as OrganizationsStore
    // which is slightly incorrect because it has summaries vs a detailed org)
    updateOrganization(data);
  };

  renderBody() {
    const {organization} = this.props;
    const {orgId} = this.props.params;
    const initialData = organization;
    const endpoint = `/organizations/${orgId}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = organization.relayPiiConfig;
    const {authProvider} = this.state;
    const title = t('Security & Privacy');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={organization.slug} />
        <SettingsPageHeader title={title} />
        <Form
          data-test-id="organization-settings-security-and-privacy"
          apiMethod="PUT"
          apiEndpoint={endpoint}
          initialData={initialData}
          additionalFieldProps={{hasSsoEnabled: !!authProvider}}
          onSubmitSuccess={this.handleUpdateOrganization}
          onSubmitError={() => addErrorMessage(t('Unable to save change'))}
          saveOnBlur
          allowUndo
        >
          <JsonForm
            features={features}
            forms={organizationSecurityAndPrivacyGroups}
            disabled={!access.has('org:write')}
          />
        </Form>
        <DataScrubbing
          additionalContext={t('These rules can be configured for each project.')}
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          disabled={!access.has('org:write')}
          organization={organization}
          onSubmitSuccess={this.handleUpdateOrganization}
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(OrganizationSecurityAndPrivacyContent);
