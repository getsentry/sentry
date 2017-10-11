import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {
  addErrorMessage,
  addSuccessMessage,
} from '../../../../actionCreators/settingsIndicator';
import ApiMixin from '../../../../mixins/apiMixin';
import Form from '../../../../components/forms/next/form';
import JsonForm from '../../../../components/forms/next/jsonForm';
import organizationSettingsFields from '../../../../data/forms/organizationGeneralSettings';

const TOAST_DURATION = 10000;

const NewOrganizationSettingsForm = React.createClass({
  propTypes: {
    location: PropTypes.object,
    orgId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    initialData: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  render() {
    let {initialData, orgId} = this.props;

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
