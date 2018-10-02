import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';
import queryString from 'query-string';
import styled from 'react-emotion';

import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import Form from 'app/views/settings/components/forms/form';
import NavTabs from 'app/components/navTabs';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const MESSAGES_BY_ACTION = {
  link: t('Successfully linked issue.'),
  create: t('Successfully created issue.'),
};

const SUBMIT_LABEL_BY_ACTION = {
  link: t('Link Issue'),
  create: t('Create Issue'),
};

class ExternalIssueForm extends AsyncComponent {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
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
    let query = {action, ...dynamicFieldValues};

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

    return config
      .filter(field => field.updatesForm)
      .reduce((a, field) => ({...a, [field.name]: field.default}), {});
  }

  onFieldChange = (label, value) => {
    let dynamicFields = this.getDynamicFields();
    if (label in dynamicFields) {
      let dynamicFieldValues = this.state.dynamicFieldValues || {};
      dynamicFieldValues[label] = value;

      this.setState(
        {
          dynamicFieldValues,
          reloading: true,
          error: false,
          remainingRequests: 1,
        },
        this.refetchConfig
      );
    }
  };

  getOptions = (field, input) => {
    if (!input) {
      const options = (field.choices || []).map(([value, label]) => ({value, label}));
      return Promise.resolve({options});
    }

    let query = queryString.stringify({
      ...this.state.dynamicFieldValues,
      field: field.name,
      query: input,
    });

    let url = field.url;
    let separator = url.includes('?') ? '&' : '?';

    let request = {
      url: [url, separator, query].join(''),
      method: 'GET',
    };

    // We can't use the API client here since the URL is not scapped under the
    // API endpoints (which the client prefixes)
    return $.ajax(request).then(data => ({options: data}));
  };

  getFieldProps = field =>
    field.url
      ? {
          loadOptions: input => this.getOptions(field, input),
          async: true,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: true,
        }
      : {};

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
        submitLabel={SUBMIT_LABEL_BY_ACTION[action]}
        submitDisabled={this.state.reloading}
        footerClass="modal-footer"
      >
        {config.map(field => (
          <FieldFromConfig
            key={field.default || field.name}
            field={field}
            inline={false}
            stacked
            flexibleControlStateSize
            disabled={this.state.reloading}
            {...this.getFieldProps(field)}
          />
        ))}
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

    this.state = {
      showModal: false,
      action: 'create',
      selectedIntegration: this.props.integration,
      issue: this.getIssue(),
      ...this.getDefaultState(),
    };
  }

  getEndpoints() {
    return [];
  }

  getIssue() {
    return this.props.integration && this.props.integration.externalIssues
      ? this.props.integration.externalIssues[0]
      : null;
  }

  deleteIssue(issueId) {
    let {group, integration} = this.props;
    let endpoint = `/groups/${group.id}/integrations/${integration.id}/?externalIssue=${issueId}`;
    this.api.request(endpoint, {
      method: 'DELETE',
      success: (data, _, jqXHR) => {
        addSuccessMessage(t('Successfully unlinked issue.'));
        this.setState({
          issue: null,
        });
      },
      error: error => {
        addErrorMessage(t('Unable to unlink issue.'));
      },
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
    this.setState({
      showModal: false,
      action: null,
      issue: data && data.id ? data : null,
    });
  };

  handleClick = action => {
    this.setState({action});
  };

  renderBody() {
    let {action, selectedIntegration, issue} = this.state;
    return (
      <React.Fragment>
        <IssueSyncListElement
          onOpen={this.openModal}
          externalIssueLink={issue ? issue.url : null}
          externalIssueId={issue ? issue.id : null}
          externalIssueKey={issue ? issue.key : null}
          externalIssueDisplayName={issue ? issue.displayName : null}
          onClose={this.deleteIssue.bind(this)}
          integrationType={selectedIntegration.provider.key}
          integrationName={selectedIntegration.name}
          hoverCardHeader={t('Linked %s Integration', selectedIntegration.provider.name)}
          hoverCardBody={
            issue && issue.title ? (
              <div>
                <IssueTitle>{issue.title}</IssueTitle>
                {issue.description && (
                  <IssueDescription>{issue.description}</IssueDescription>
                )}
              </div>
            ) : (
              <IntegrationItem integration={selectedIntegration} />
            )
          }
        />
        {selectedIntegration && (
          <Modal
            show={this.state.showModal}
            onHide={this.closeModal}
            animation={false}
            enforceFocus={false}
          >
            <Modal.Header closeButton>
              <Modal.Title>{`${selectedIntegration.provider.name} Issue`}</Modal.Title>
            </Modal.Header>
            <NavTabs underlined={true}>
              <li className={action === 'create' ? 'active' : ''}>
                <a onClick={() => this.handleClick('create')}>{t('Create')}</a>
              </li>
              <li className={action === 'link' ? 'active' : ''}>
                <a onClick={() => this.handleClick('link')}>{t('Link')}</a>
              </li>
            </NavTabs>
            <Modal.Body>
              {action && (
                <ExternalIssueForm
                  // need the key here so React will re-render
                  // with a new action prop
                  key={action}
                  group={this.props.group}
                  integration={selectedIntegration}
                  action={action}
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

const IssueTitle = styled('div')`
  font-size: 1.1em;
  font-weight: 600;
  ${overflowEllipsis};
`;

const IssueDescription = styled('div')`
  margin-top: ${space(1)};
  ${overflowEllipsis};
`;

export default ExternalIssueActions;
