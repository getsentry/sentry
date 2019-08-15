import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {createIncident} from 'app/actionCreators/incident';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import SentryTypes from 'app/sentryTypes';
import TextField from 'app/views/settings/components/forms/textField';
import withApi from 'app/utils/withApi';

class CreateIncidentModal extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    issues: PropTypes.arrayOf(PropTypes.string),
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  handleSubmit = async (data, onSuccess, onError, _e, setFormSavingState) => {
    const {api, organization, issues} = this.props;

    setFormSavingState();

    try {
      const incident = await createIncident(api, organization, data.title, issues);
      onSuccess(incident);
    } catch (err) {
      onError(err);
    }
  };

  handleSuccess = data => {
    const {organization, onClose, closeModal} = this.props;

    if (onClose) {
      onClose(data);
    }

    closeModal();

    if (data) {
      browserHistory.push(
        `/organizations/${organization.slug}/incidents/${data.identifier}/`
      );
    }
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
            data-test-id="create-new-incident-form"
            submitLabel={t('Create Incident')}
            onSubmit={this.handleSubmit}
            onSubmitSuccess={this.handleSuccess}
            requireChanges
            initialData={{
              date: new Date(),
            }}
          >
            <TextField
              name="title"
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

export default withApi(CreateIncidentModal);
