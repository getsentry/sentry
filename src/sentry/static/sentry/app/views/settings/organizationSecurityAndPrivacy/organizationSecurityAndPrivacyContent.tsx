import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Form from 'app/views/settings/components/forms/form';
import AsyncView from 'app/views/asyncView';
import {Organization} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {updateOrganization} from 'app/actionCreators/organizations';
import organizationSecurityAndPrivacy from 'app/data/forms/organizationSecurityAndPrivacy';
import SentryTypes from 'app/sentryTypes';

import DataPrivacyRulesPanel from '../components/dataPrivacyRulesPanel/dataPrivacyRulesPanel';

type Props = {
  organization: Organization;
  params: {
    orgId: string;
    projectId: string;
  };
} & RouteComponentProps<{}, {}>;

class OrganizationSecurityAndPrivacyContent extends AsyncView<Props> {
  static contextTypes = {
    organization: SentryTypes.Organization,
    // left router contextType to satisfy the compiler
    router: PropTypes.object,
  };

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;
    return [
      ['data', `/organizations/${orgId}/`],
      ['authProvider', `/organizations/${orgId}/auth-provider/`],
    ];
  }

  handleSave = (data: Organization) => {
    // This will update OrganizationStore (as well as OrganizationsStore
    // which is slightly incorrect because it has summaries vs a detailed org)
    updateOrganization(data);
  };

  renderBody() {
    const {organization} = this.context;
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
            this.handleSave(model.initialData as Organization);
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
        <DataPrivacyRulesPanel
          additionalContext={t('These rules can be configured for each project.')}
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          disabled={!access.has('org:write')}
        />
      </React.Fragment>
    );
  }
}

export default OrganizationSecurityAndPrivacyContent;
