import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import DropdownLink from 'app/components/dropdownLink';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';

const MESSAGES_BY_ACTION = {
  link: t('Successfully linked issue.'),
  create: t('Successfully created issue.'),
};

class ExternalIssueForm extends AsyncComponent {
  static propTypes = {
    group: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
    action: PropTypes.string.isRequired,
    onSubmitSuccess: PropTypes.func.isRequired,
  };

  getEndpoints() {
    let {action, group, integration} = this.props;
    return [
      [
        'integrationDetails',
        `/groups/${group.id}/integrations/${integration.id}/?action=${action}`,
      ],
    ];
  }

  onSubmitSuccess = () => {
    addSuccessMessage(MESSAGES_BY_ACTION[this.props.action]);
    this.props.onSubmitSuccess && this.props.onSubmitSuccess();
  };

  renderBody() {
    let {integrationDetails} = this.state;
    let {action, group, integration} = this.props;
    return (
      <Form
        apiEndpoint={`/groups/${group.id}/integrations/${integration.id}/`}
        apiMethod={action === 'create' ? 'POST' : 'PUT'}
        onSubmitSuccess={this.onSubmitSuccess}
      >
        {integrationDetails[`${action}IssueConfig`].map(field => {
          return <FieldFromConfig key={field.name} field={field} />;
        })}
      </Form>
    );
  }
}

class ExternalIssueActionList extends AsyncComponent {
  static propTypes = {
    group: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.state.showModal = false;
    this.state.selectedIntegration = null;
  }

  getEndpoints() {
    let {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  openModal = integration => {
    this.setState({
      showModal: true,
      selectedIntegration: integration,
    });
  };

  closeModal = () => {
    this.setState({
      showModal: false,
      selectedIntegration: null,
    });
  };

  renderBody() {
    let {selectedIntegration} = this.state;
    return (
      <React.Fragment>
        {this.state.integrations.map(integration => {
          return (
            <MenuItem key={integration.id} noAnchor={true}>
              <a onClick={this.openModal.bind(this, integration)}>
                Link {integration.provider.name} issue
              </a>
            </MenuItem>
          );
        })}
        {selectedIntegration && (
          <Modal
            show={this.state.showModal}
            onHide={this.closeModal}
            animation={false}
            backdrop="static"
            enforceFocus={false}
          >
            <Modal.Header closeButton>
              <Modal.Title>{`${selectedIntegration.provider.name} Issue`}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <ExternalIssueForm
                group={this.props.group}
                integration={selectedIntegration}
                action="link"
                onSubmitSuccess={this.closeModal}
              />
            </Modal.Body>
          </Modal>
        )}
      </React.Fragment>
    );
  }
}

class ExternalIssueActions extends React.Component {
  static propTypes = {
    group: PropTypes.object.isRequired,
  };

  render() {
    return (
      <DropdownLink
        title={t('External Issues')}
        caret={true}
        className="btn btn-default btn-sm"
      >
        <ExternalIssueActionList group={this.props.group} />
      </DropdownLink>
    );
  }
}

export default ExternalIssueActions;
