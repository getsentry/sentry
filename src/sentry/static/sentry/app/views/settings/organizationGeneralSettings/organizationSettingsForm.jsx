import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {updateOrganization} from 'app/actionCreators/organizations';
import AvatarChooser from 'app/components/avatarChooser';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import OrganizationState from 'app/mixins/organizationState';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import organizationSettingsFields from 'app/data/forms/organizationGeneralSettings';

const OrganizationSettingsForm = createReactClass({
  displayName: 'OrganizationSettingsForm',

  propTypes: {
    location: PropTypes.object,
    orgId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    initialData: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
  },

  mixins: [OrganizationState],

  render() {
    const {initialData, orgId, onSave, access} = this.props;
    const endpoint = `/organizations/${orgId}/`;
    return (
      <Form
        className="ref-organization-settings"
        apiMethod="PUT"
        apiEndpoint={endpoint}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitSuccess={(resp, model, fieldName, change) => {
          // Special case for slug, need to forward to new slug
          if (typeof onSave === 'function') {
            onSave(initialData, model.initialData);
          }
        }}
        onSubmitError={err => addErrorMessage('Unable to save change')}
      >
        <PermissionAlert />
        <JsonForm
          features={this.getFeatures()}
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
  },
});

export default OrganizationSettingsForm;
