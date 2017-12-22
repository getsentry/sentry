import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {
  addErrorMessage,
  addSuccessMessage,
} from '../../../../actionCreators/settingsIndicator';
import ApiMixin from '../../../../mixins/apiMixin';
import Form from '../../components/forms/form';
import JsonForm from '../../components/forms/jsonForm';
import organizationSettingsFields from '../../../../data/forms/organizationGeneralSettings';
import OrganizationState from '../../../../mixins/organizationState';

const TOAST_DURATION = 10000;

const NewOrganizationSettingsForm = React.createClass({
  propTypes: {
    location: PropTypes.object,
    orgId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    initialData: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin, OrganizationState],

  render() {
    let {initialData, orgId, onSave} = this.props;

    //Only for adding the Flag to 2FA Enforcement. Please remove when the feature is released to the public.
    if (!this.getFeatures().has('require-2fa')) {
      let security_panel = organizationSettingsFields.find(function(panel) {
        return panel.title == 'Security & Privacy';
      });
      security_panel.fields.splice(
        security_panel.fields.findIndex(function(field) {
          return field.name == 'require2FA';
        }),
        1
      );
    }

    return (
      <Form
        apiMethod="PUT"
        apiEndpoint={`/organizations/${orgId}/`}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitSuccess={(change, model, id) => {
          if (!model) return;

          let label = model.getDescriptor(id, 'label');

          if (!label) return;

          addSuccessMessage(
            `Changed ${label} from "${change.old}" to "${change.new}"`,
            TOAST_DURATION,
            {model, id}
          );

          // Special case for slug, need to forward to new slug
          if (typeof onSave === 'function') {
            onSave(initialData, model.initialData);
          }
        }}
        onSubmitError={() => addErrorMessage('Unable to save change', TOAST_DURATION)}
      >
        <Box>
          <JsonForm location={this.props.location} forms={organizationSettingsFields} />
        </Box>
      </Form>
    );
  },
});

export default NewOrganizationSettingsForm;
