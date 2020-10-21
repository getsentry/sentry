import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import {css} from '@emotion/core';

import {t} from 'app/locale';
import ProjectOwnershipModal from 'app/views/settings/project/projectOwnership/modal';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';

class CreateOwnershipRuleModal extends Component {
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
      <Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Create Ownership Rule')}
        </Header>
        <Body>
          <ProjectOwnershipModal {...props} onSave={this.handleSuccess} />
        </Body>
      </Fragment>
    );
  }
}

export const modalCss = css`
  @media (min-width: ${theme.breakpoints[0]}) {
    .modal-dialog {
      width: 80%;
      margin-left: -40%;
    }
  }
  .modal-content {
    overflow: initial;
  }
`;

export default CreateOwnershipRuleModal;
