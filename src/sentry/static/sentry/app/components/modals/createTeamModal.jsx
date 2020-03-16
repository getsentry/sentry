import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {createTeam} from 'app/actionCreators/teams';
import {t} from 'app/locale';
import CreateTeamForm from 'app/components/createTeamForm';
import SentryTypes from 'app/sentryTypes';

class CreateTeamModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project,
  };

  handleSubmit = (data, onSuccess, onError) => {
    createTeam(new Client(), data, {orgId: this.props.organization.slug})
      .then(resp => {
        this.handleSuccess(resp);
        onSuccess(resp);
      })
      .catch(err => {
        onError(err);
      });
  };

  handleSuccess = data => {
    if (this.props.onClose) {
      this.props.onClose(data);
    }

    this.props.closeModal();
  };

  render() {
    const {Body, Header, closeModal, ...props} = this.props;

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Create Team')}
        </Header>
        <Body>
          <CreateTeamForm {...props} onSubmit={this.handleSubmit} />
        </Body>
      </React.Fragment>
    );
  }
}

export default CreateTeamModal;
