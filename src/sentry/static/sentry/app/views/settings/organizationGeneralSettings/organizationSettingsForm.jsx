import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {updateOrganization} from 'app/actionCreators/organizations';
import Alert from 'app/components/alert';
import ApiMixin from 'app/mixins/apiMixin';
import AvatarChooser from 'app/components/avatarChooser';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import OrganizationState from 'app/mixins/organizationState';
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

  mixins: [ApiMixin, OrganizationState],

  render() {
    let {initialData, orgId, onSave, access} = this.props;
    let endpoint = `/organizations/${orgId}/`;
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
        {!access.has('org:write') && (
          <Alert type="warning" icon="icon-warning-sm">
            {t(
              'These settings can only be edited by users with the owner or manager role.'
            )}
          </Alert>
        )}
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
