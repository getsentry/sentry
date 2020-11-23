import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';

import Button from 'app/components/button';
import {IconSettings} from 'app/icons';

type Props = {};

type State = {
  showModal: boolean;
};

class TicketRuleForm extends React.Component<Props, State> {
  state = {
    showModal: false,
  };

  openModal = () => {
    this.setState({
      showModal: true,
    });
  };

  closeModal = () => {
    this.setState({
      showModal: false,
    });
  };

  render() {
    return (
      <React.Fragment>
        <Button
          size="small"
          icon={<IconSettings size="xs" />}
          onClick={() => this.openModal()}
        >
          Issue Link Settings
        </Button>
        <Modal
          show={this.state.showModal}
          onHide={this.closeModal}
          animation={false}
          enforceFocus={false}
          backdrop="static"
        >
          <Modal.Header closeButton>
            <Modal.Title>Issue Link Settings</Modal.Title>
          </Modal.Header>
          <Modal.Body>replace me with an ExternalIssueForm in API-1448</Modal.Body>
        </Modal>
      </React.Fragment>
    );
  }
}

export default TicketRuleForm;
