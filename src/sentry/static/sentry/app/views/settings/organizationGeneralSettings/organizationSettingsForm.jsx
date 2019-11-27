import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {updateOrganization} from 'app/actionCreators/organizations';
import AsyncComponent from 'app/components/asyncComponent';
import AvatarChooser from 'app/components/avatarChooser';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import SentryTypes from 'app/sentryTypes';
import organizationSettingsFields from 'app/data/forms/organizationGeneralSettings';
import withOrganization from 'app/utils/withOrganization';

class OrganizationSettingsForm extends AsyncComponent {
  static propTypes = {
    location: PropTypes.object,
    organization: SentryTypes.Organization,
    orgId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    initialData: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
  };

  getEndpoints() {
    const {orgId} = this.props;
    return [['authProvider', `/organizations/${orgId}/auth-provider/`]];
  }

  render() {
    const {initialData, organization, orgId, onSave, access} = this.props;
    const {authProvider} = this.state;
    const endpoint = `/organizations/${orgId}/`;
    return (
      <Form
        className="ref-organization-settings"
        apiMethod="PUT"
        apiEndpoint={endpoint}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitSuccess={(_resp, model) => {
          // Special case for slug, need to forward to new slug
          if (typeof onSave === 'function') {
            onSave(initialData, model.initialData);
          }
        }}
        onSubmitError={() => addErrorMessage('Unable to save change')}
      >
        <PermissionAlert />
        <JsonForm
          additionalFieldProps={{hasSsoEnabled: !!authProvider}}
          features={new Set(organization.features)}
          access={access}
          location={this.props.location}
          forms={organizationSettingsFields}
          disabled={!access.has('org:write')}
        />
        <AvatarChooser
          type="organization"
          allowGravatar={false}
          endpoint={`${endpoint}avatar/`}
          model={initialData}
          onSave={updateOrganization}
          disabled={!access.has('org:write')}
        />
      </Form>
    );
  }
}

export default withOrganization(OrganizationSettingsForm);
