import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';

import Button from 'app/components/button';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import {IconSettings} from 'app/icons';

type Props = {
  data: any;
};

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

  linkIssueSuccess = (onSuccess: () => void) => {
    // this.props.onChange(() => onSuccess());
    this.closeModal();
  };

  renderFields = () => {
    let fields = [];
    const formFields = Object.values(this.props.data.formFields);
    delete formFields.jira_integration; // this doesn't have a name field and doesn't render anyway
    
    for (const key in formFields) {
      fields.push(
        <FieldFromConfig
          key={formFields[key].name}
          field={formFields[key]}
          inline={false}
          stacked
          flexibleControlStateSize
        />
        )
    }
    return fields;
  }

  render() {
    console.log("the props data: ")
    console.log(this.props.data);
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
          <Modal.Body>
            <Form
              // apiEndpoint={`/groups/${group.id}/integrations/${integration.id}/`}
              // apiMethod={action === 'create' ? 'POST' : 'PUT'}
              // onSubmitSuccess={this.onSubmitSuccess}
              initialData={this.props.data}
              // onFieldChange={this.onFieldChange}
              // submitLabel={SUBMIT_LABEL_BY_ACTION[action]}
              // submitDisabled={this.state.reloading}
              // footerClass="modal-footer"
              // onPreSubmit={this.handlePreSubmit}
              // onSubmitError={this.handleSubmitError}
            >
            {this.renderFields}
            </Form>


            {/* 
              okay maybe fuck ExternalIssueForm and just do our own

            */}
            {/* 
                <ExternalIssueForm
                  // need the key here so React will re-render
                  // with a new action prop
                  key={this.props.data.actionType}
                  group={this.props.group} // don't have access to group
                  integration={integration}
                  action='create'
                  onSubmitSuccess={(_, onSuccess) => this.linkIssueSuccess(onSuccess)}
                />
            */}
          </Modal.Body>
        </Modal>
      </React.Fragment>
    );
  }
}

export default TicketRuleForm;
