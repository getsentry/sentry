import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
// import SentryTypes from 'app/sentryTypes';
import TextField from 'app/views/settings/components/forms/textField';

class CreateIncidentModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    // organization: SentryTypes.Organization.isRequired,
  };

  handleSubmit = (data, onSuccess, onError) => {
    // TODO(billy): Actually create incident and handle success follow up
  };

  handleSuccess = data => {
    if (this.props.onClose) {
      this.props.onClose(data);
    }

    this.props.closeModal();
  };

  render() {
    const {Body, Header, closeModal} = this.props;

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Create New Incident')}
        </Header>
        <Body>
          <Form
            submitLabel={t('Create Incident')}
            onSubmit={this.handleSubmit}
            onSubmitSuccess={this.handleSuccess}
            requireChanges
          >
            <TextField
              name="name"
              label={t('Incident Name')}
              placeholder={t('Incident Name')}
              help={t('Give a name to help identify the incident')}
              required
              stacked
              inline={false}
              flexibleControlStateSize
            />
          </Form>
        </Body>
      </React.Fragment>
    );
  }
}

export default CreateIncidentModal;
