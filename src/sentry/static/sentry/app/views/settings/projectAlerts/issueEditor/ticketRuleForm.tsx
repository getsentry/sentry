import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';

import Button from 'app/components/button';
import {IconSettings} from 'app/icons';
import {t} from 'app/locale';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';

type Props = {
  data: any;
};

type State = {
  showModal: boolean;
  formData: any;
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

  getNames = () => {
    const names = [];
    for (const name in this.props.data.formFields) {
      if (this.props.data.formFields[name].hasOwnProperty('name')) {
        names.push(this.props.data.formFields[name].name);
      }
    }
    return names;
  };

  cleanData = data => {
    const names = this.getNames();
    const formData = {};

    for (const [key, value] of Object.entries(data)) {
      if (names.includes(key)) {
        formData[key] = value;
      }
    }
    return formData;
  };

  onFormSubmit = (data: any) => {
    const formData = this.cleanData(data);
    this.props.onSubmitAction(formData);
    this.closeModal();
  };

  renderFields = () => {
    const fields = [];
    this.props.data.formFields.reporter.required = false; // this is a hack for now until I figure out how to populate it with loadOptions!!
    const formFields = Object.values(this.props.data.formFields);

    for (const key in formFields) {
      if (formFields[key].hasOwnProperty('name')) {
        fields.push(
          <FieldFromConfig
            key={formFields[key].name}
            field={formFields[key]}
            inline={false}
            stacked
            flexibleControlStateSize
            // loadOptions={() => {console.log("helloooo")}}
            // async={true}
            // cache={false}
            // onSelectResetsInput={false}
            // onCloseResetsInput={false}
            // onBlurResetsInput={false}
            // autoload={true}
          />
        );
      }
    }
    return fields;
  };

  render() {
    const submitLabel = t('Apply Changes');
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
              onSubmit={this.onFormSubmit}
              // onSubmitSuccess={this.formSubmitSuccess}
              initialData={this.props.data}
              // onFieldChange={this.onFieldChange}
              submitLabel={submitLabel}
              // submitDisabled={this.state.reloading}
              // footerClass="modal-footer"
              // onPreSubmit={this.handlePreSubmit}
              // onSubmitError={this.handleSubmitError}
            >
              {this.renderFields}
            </Form>
          </Modal.Body>
        </Modal>
      </React.Fragment>
    );
  }
}

export default TicketRuleForm;
