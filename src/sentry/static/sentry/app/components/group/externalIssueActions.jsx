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
import _ from 'lodash';
import styled from 'react-emotion';
import space from 'app/styles/space';

import IssueSyncListElement from 'app/components/issueSyncListElement';

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

  onSubmitSuccess = data => {
    addSuccessMessage(MESSAGES_BY_ACTION[this.props.action]);
    this.props.onSubmitSuccess(data);
  };

  getOptions = (field, input) => {
    if (!input) {
      return Promise.resolve([]);
    }
    let {dynamicFieldValues} = this.state;
    let additionalParams = Object.entries(dynamicFieldValues)
      .map(([key, val]) => {
        return `${key}=${encodeURIComponent(val)}`;
      })
      .join('&');
    if (additionalParams) {
      additionalParams = `&${additionalParams}`;
    }

    let url = field.url;
    let separator = url.includes('?') ? '&' : '?';
    return $
      .ajax({
        url: `${url}${separator}field=${field.name}&query=${input}${additionalParams}`,
        method: 'GET',
      })
      .then(data => {
        return {options: data};
      });
  };

  onRequestSuccess({stateKey, data, jqXHR}) {
    if (stateKey === 'integrationDetails' && !this.state.dynamicFieldValues) {
      this.setState({
        dynamicFieldValues: this.getDynamicFields(data),
      });
    }
  }

  refetchConfig = () => {
    let {dynamicFieldValues} = this.state;
    let {action, group, integration} = this.props;
    let endpoint = `/groups/${group.id}/integrations/${integration.id}/`;
    let query = {
      action,
    };
    Object.entries(dynamicFieldValues).map(([key, val]) => {
      query[key] = val;
    });
    this.api.request(endpoint, {
      method: 'GET',
      query,
      success: (data, _, jqXHR) => {
        this.handleRequestSuccess({stateKey: 'integrationDetails', data, jqXHR}, true);
      },
      error: error => {
        this.handleError(error, ['integrationDetails', endpoint, null, null]);
      },
    });
  };

  getDynamicFields(integrationDetails) {
    integrationDetails = integrationDetails || this.state.integrationDetails;
    let {action} = this.props;
    let config = integrationDetails[`${action}IssueConfig`];
    let dynamicFields = {};
    config.filter(field => field.updatesForm).forEach(field => {
      dynamicFields[field.name] = field.default;
    });
    return dynamicFields;
  }

  onFieldChange = (label, value) => {
    let dynamicFields = this.getDynamicFields();
    if (label in dynamicFields) {
      let dynamicFieldValues = this.state.dynamicFieldValues || {};
      dynamicFieldValues[label] = value;

      this.setState(
        {
          dynamicFieldValues,
          loading: true,
          error: false,
          remainingRequests: 1,
        },
        this.refetchConfig
      );
    }
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
        onFieldChange={this.onFieldChange}
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
          return <FieldFromConfig key={field.name} field={field} {...props} />;
        })}
      </Form>
    );
  }
}

class ExternalIssueActions extends AsyncComponent {
  static propTypes = {
    group: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.state.showModal = false;
    this.state.selectedIntegration = this.props.integration;
    this.state.action = 'create';
    this.state.issue = this.getIssue();
  }

  getIssue() {
    return this.props.integration.externalIssues[0];
  }

  deleteIssue(issueId) {
    let {group, integration} = this.props;
    let endpoint = `/groups/${group.id}/integrations/${integration.id}/`;
    this.api.request(endpoint, {
      method: 'DELETE',
      data: {
        externalIssue: issueId,
      },
      success: (data, _, jqXHR) => {
        this.setState({
          issue: null,
        });
      },
      error: error => {},
    });
  }

  openModal = () => {
    const {integration} = this.props;
    this.setState({
      showModal: true,
      selectedIntegration: integration,
      action: 'create',
    });
  };

  closeModal = data => {
    if (data.id) {
      this.setState({
        showModal: false,
        action: null,
        issue: data,
      });
    } else {
      this.setState({
        showModal: false,
        action: null,
      });
    }
  };

  handleClick = evt => {
    this.setState({
      action: evt.target.id,
    });
  };

  renderBody() {
    let {action, selectedIntegration, issue} = this.state;

    return (
      <React.Fragment key={selectedIntegration.id}>
        <IssueSyncListElement
          openModal={this.openModal}
          externalIssueLink={issue ? issue.key : null}
          externalIssueId={issue ? issue.id : null}
          onClose={this.deleteIssue.bind(this)}
          integrationType={selectedIntegration.provider.key}
        />
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
            {action == 'create' && (
              <React.Fragment>
                <ActiveActionButton id="create" onClick={this.handleClick}>
                  Create
                </ActiveActionButton>
                <ActionButton id="link" onClick={this.handleClick}>
                  Link
                </ActionButton>
              </React.Fragment>
            )}
            {action == 'link' && (
              <React.Fragment>
                <ActionButton id="create" onClick={this.handleClick}>
                  Create
                </ActionButton>
                <ActiveActionButton id="link" onClick={this.handleClick}>
                  Link
                </ActiveActionButton>
              </React.Fragment>
            )}
            <Modal.Body>
              {action == 'create' && (
                <ExternalIssueForm
                  group={this.props.group}
                  integration={selectedIntegration}
                  action={'create'}
                  onSubmitSuccess={this.closeModal}
                />
              )}
              {action == 'link' && (
                <ExternalIssueForm
                  group={this.props.group}
                  integration={selectedIntegration}
                  action={'link'}
                  onSubmitSuccess={this.closeModal}
                />
              )}
            </Modal.Body>
          </Modal>
        )}
      </React.Fragment>
    );
  }
}

const ActionButton = styled('span')`
  margin-right: ${space(1)};
  border: none;
  padding: ${space(1)} ${space(1.5)};
  top: ${space(-10)};
`;

const ActiveActionButton = styled('span')`
  margin-right: ${space(1)};
  border: none;
  padding: ${space(1)} ${space(1.5)};
  top: ${space(-10)};
  border-bottom: 4px solid ${p => p.theme.purple};
`;

export default ExternalIssueActions;
