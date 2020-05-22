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
import organizationSecurityAndPrivacy from 'app/data/forms/organizationSecurityAndPrivacy';

import DataPrivacyRules from '../components/dataPrivacyRules/dataPrivacyRules';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
};

class OrganizationSecurityAndPrivacyContent extends AsyncView<Props> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;
    return [
      ['data', `/organizations/${orgId}/`],
      ['authProvider', `/organizations/${orgId}/auth-provider/`],
    ];
  }

  handleUpdateOrganization = (data: Organization) => {
    // This will update OrganizationStore (as well as OrganizationsStore
    // which is slightly incorrect because it has summaries vs a detailed org)
    updateOrganization(data);
  };

  renderBody() {
    const {organization} = this.props;
    const {orgId} = this.props.params;
    const {authProvider} = this.state;
    const initialData = this.props.organization;
    const endpoint = `/organizations/${orgId}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = this.state.data?.relayPiiConfig;

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Security & Privacy')} />
        <Form
          data-test-id="organization-settings-security-and-privacy"
          apiMethod="PUT"
          apiEndpoint={endpoint}
          initialData={initialData}
          additionalFieldProps={{hasSsoEnabled: !!authProvider}}
          onSubmitSuccess={(_resp, model) => {
            this.handleUpdateOrganization(model.initialData as Organization);
          }}
          onSubmitError={() => addErrorMessage('Unable to save change')}
          saveOnBlur
          allowUndo
        >
          <JsonForm
            features={features}
            forms={organizationSecurityAndPrivacy}
            disabled={!access.has('org:write')}
          />
        </Form>
        <DataPrivacyRules
          additionalContext={t('These rules can be configured for each project.')}
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          disabled={!access.has('org:write')}
          organization={organization}
          onSubmitSuccess={resp => {
            this.handleUpdateOrganization(resp as Organization);
          }}
        />
      </React.Fragment>
    );
  }
}

export default OrganizationSecurityAndPrivacyContent;
