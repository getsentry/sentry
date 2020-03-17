import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import ProjectOwnershipModal from 'app/views/settings/project/projectOwnership/modal';
import SentryTypes from 'app/sentryTypes';

class CreateOwnershipRuleModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project,
  };

  handleSubmit = () => {
    this.handleSuccess();
  };

  handleSuccess = data => {
    if (this.props.onClose) {
      this.props.onClose(data);
    }
    window.setTimeout(this.props.closeModal, 2000);
  };

  render() {
    const {Body, Header, closeModal, ...props} = this.props;

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Create Ownership Rule')}
        </Header>
        <Body>
          <ProjectOwnershipModal {...props} onSave={this.handleSuccess} />
        </Body>
      </React.Fragment>
    );
  }
}

export default CreateOwnershipRuleModal;
