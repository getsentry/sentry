import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../locale';
import Ownership from '../../views/settings/project/projectOwnership/modal';
import SentryTypes from '../../proptypes';

class CreateOwnershipRuleModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project,
  };

  handleSubmit = data => {
    this.handleSuccess();
  };

  handleSuccess = data => {
    if (this.props.onClose) {
      this.props.onClose(data);
    }

    this.props.closeModal();
  };

  render() {
    let {Body, Header, closeModal, ...props} = this.props;

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Create Ownership Rule')}
        </Header>
        <Body>
          <Ownership {...props} />
        </Body>
      </React.Fragment>
    );
  }
}

export default CreateOwnershipRuleModal;
