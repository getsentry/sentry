import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import DropdownLink from 'app/components/dropdownLink';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import MenuItem from 'app/components/menuItem';
import {t, tct} from 'app/locale';

const MESSAGES_BY_ACTION = {
  link: t('Successfully linked issue.'),
  create: t('Successfully created issue.'),
};

class ExternalIssueForm extends AsyncComponent {
  static propTypes = {
    group: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
    action: PropTypes.oneOf(['link', 'create']),
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
    this.props.onSubmitSuccess();
  };

  getOptions = (field, input) => {
    if (!input) {
      return Promise.resolve([]);
    }
    return $.ajax({
      url: `${field.url}?field=${field.name}&query=${input}`,
      method: 'GET',
    }).then(data => {
      return {options: data};
    });
  };

  renderBody() {
    let {integrationDetails} = this.state;
    let {action, group, integration} = this.props;
    let config = integrationDetails[`${action}IssueConfig`];
    let initialData = {};
    config.forEach(field => {
      // passing an empty array breaks multi select
      // TODO(jess): figure out why this is breaking and fix
      initialData[field.name] = field.multiple ? '' : field.default;
    });
    return (
      <Form
        apiEndpoint={`/groups/${group.id}/integrations/${integration.id}/`}
        apiMethod={action === 'create' ? 'POST' : 'PUT'}
        onSubmitSuccess={this.onSubmitSuccess}
        initialData={initialData}
      >
        {config.map(field => {
          let props = {};
          if (field.url) {
            props = {
              loadOptions: input => {
                return this.getOptions(field, input);
              },
              async: true,
              cache: false,
              onSelectResetsInput: false,
              onCloseResetsInput: false,
              onBlurResetsInput: false,
              autoload: false,
            };
          }
          return <FieldFromConfig key={field.name} field={field} {...props}/>;
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
    this.state.action = null;
  }

  getEndpoints() {
    let {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  openModal = (integration, action) => {
    this.setState({
      showModal: true,
      selectedIntegration: integration,
      action,
    });
  };

  closeModal = () => {
    this.setState({
      showModal: false,
      selectedIntegration: null,
      action: null,
    });
  };

  renderBody() {
    let {selectedIntegration, action} = this.state;
    return (
      <React.Fragment>
        {this.state.integrations.map(integration => {
          return (
            <React.Fragment key={integration.id}>
              <MenuItem noAnchor={true}>
                <a onClick={this.openModal.bind(this, integration, 'link')}>
                  {tct('Link [provider] issue', {provider: integration.provider.name})}
                </a>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <a onClick={this.openModal.bind(this, integration, 'create')}>
                  {tct('Create [provider] issue', {provider: integration.provider.name})}
                </a>
              </MenuItem>
            </React.Fragment>
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
                action={action}
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
