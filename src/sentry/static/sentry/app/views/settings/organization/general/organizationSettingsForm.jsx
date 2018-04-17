import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import {addErrorMessage} from '../../../../actionCreators/indicator';
import ApiMixin from '../../../../mixins/apiMixin';
import Form from '../../components/forms/form';
import JsonForm from '../../components/forms/jsonForm';
import {Box} from '../../../../components/grid';
import organizationSettingsFields from '../../../../data/forms/organizationGeneralSettings';
import OrganizationState from '../../../../mixins/organizationState';

const NewOrganizationSettingsForm = createReactClass({
  displayName: 'NewOrganizationSettingsForm',

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

    return (
      <Form
        className="ref-organization-settings"
        apiMethod="PUT"
        apiEndpoint={`/organizations/${orgId}/`}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitSuccess={(resp, model, fieldName, change) => {
          // Special case for slug, need to forward to new slug
          if (typeof onSave === 'function') {
            onSave(initialData, model.initialData);
          }
        }}
        onSubmitError={error => {
          if (error.responseJSON && 'require2FA' in error.responseJSON) {
            return addErrorMessage(
              'Unable to save change. Enable two-factor authentication on your account first.'
            );
          }
          return addErrorMessage('Unable to save change');
        }}
      >
        <Box>
          <JsonForm
            features={this.getFeatures()}
            access={access}
            location={this.props.location}
            forms={organizationSettingsFields}
          />
        </Box>
      </Form>
    );
  },
});

export default NewOrganizationSettingsForm;
