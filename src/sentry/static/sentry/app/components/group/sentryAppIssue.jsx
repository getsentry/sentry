import React from 'react';
import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import ExternalIssueActions from 'app/components/group/externalIssueActions';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import AlertLink from 'app/components/alertLink';
import SentryTypes from 'app/sentryTypes';
import PluginActions from 'app/components/group/pluginActions';
import {Box} from 'grid-emotion';
import {t} from 'app/locale';
import $ from 'jquery';
import Modal from 'react-bootstrap/lib/Modal';
import queryString from 'query-string';
import styled from 'react-emotion';

import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import NavTabs from 'app/components/navTabs';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {debounce} from 'lodash';

import {getSchemaFields} from 'app/utils/schema';

class SentryAppIssue extends AsyncComponent {

  getEndpoints() {
    return [];
  }

  renderBody() {
    return (
      <React.Fragment>
        <IssueActions group={this.props.group} />
      </React.Fragment>
    );
  }
}

export default SentryAppIssue;

const SCHEMA = {
  'type': 'issue-link',
  'link': {
      'uri': '/sentry/issues/link',
      'required_fields': [
          {
              'type': 'select',
              'name': 'assignee',
              'label': 'Assignee',
              'uri': '/sentry/members',
          },
      ],
  },

  'create': {
      'uri': '/sentry/issues/create',
      'required_fields': [
          {
              'type': 'text',
              'name': 'title',
              'label': 'Title',
          },
          {
              'type': 'text',
              'name': 'summary',
              'label': 'Summary',
          },
      ],

      'optional_fields': [
          {
              'type': 'select',
              'name': 'points',
              'label': 'Points',
              'options': [
                  ['1', '1'],
                  ['2', '2'],
                  ['3', '3'],
                  ['5', '5'],
                  ['8', '8'],
              ],
          },
          {
              'type': 'select',
              'name': 'assignee',
              'label': 'Assignee',
              'uri': '/sentry/members',
          },
      ],
  },
}

const MESSAGES_BY_ACTION = {
  link: t('Successfully linked issue.'),
  create: t('Successfully created issue.'),
};

const SUBMIT_LABEL_BY_ACTION = {
  link: t('Link Issue'),
  create: t('Create Issue'),
};

class IssueForm extends AsyncComponent {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    action: PropTypes.oneOf(['link', 'create']),
    onSubmitSuccess: PropTypes.func,
  };

  shouldRenderBadRequests = true;

  getEndpoints() {
    const {group} = this.props;
    return [];
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

  getOptions = (field, input) => {
    if (!input) {
      const options = (field.choices || []).map(([value, label]) => ({value, label}));
      return Promise.resolve({options});
    }
    return new Promise(resolve => {
      this.debouncedOptionLoad(field, input, resolve);
    });
  };

  debouncedOptionLoad = debounce(
    (field, input, resolve) => {
      const query = queryString.stringify({
        ...this.state.dynamicFieldValues,
        field: field.name,
        query: input,
      });

      const url = field.url;
      const separator = url.includes('?') ? '&' : '?';

      const request = {
        url: [url, separator, query].join(''),
        method: 'GET',
      };

      // We can't use the API client here since the URL is not scoped under the
      // API endpoints (which the client prefixes)
      $.ajax(request).then(data => resolve({options: data}));
    },
    200,
    {trailing: true}
  );

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
    const {action} = this.props;

    const initialData = {};
    const schema = getSchemaFields(SCHEMA);
    const uri = schema[action].uri;

    return (
      <Form
        apiEndpoint={'/'}
        apiMethod={action === 'create' ? 'POST' : 'PUT'}
        onSubmitSuccess={this.onSubmitSuccess}
        initialData={initialData}
        onFieldChange={this.onFieldChange}
        submitLabel={SUBMIT_LABEL_BY_ACTION[action]}
        submitDisabled={this.state.reloading}
        footerClass="modal-footer"
      >
        {schema[action].fields.map(field => (
          <FieldFromConfig
            key={`${field.name}`}
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

class IssueActions extends AsyncComponent {
  static propTypes = {
    group: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      showModal: false,
      action: 'create',
      issue: this.getIssue(),
      ...this.getDefaultState(),
    };
  }

  getEndpoints() {
    return [];
  }

  getIssue() {
    return null;
  }

  deleteIssue(issueId) {
    const {group, integration} = this.props;
    const endpoint = `/groups/${group.id}/integrations/${integration.id}/?externalIssue=${issueId}`;
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
    this.setState({
      showModal: true,
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
    const {action, issue} = this.state;
    return (
      <React.Fragment>
        <IssueSyncListElement
          onOpen={this.openModal}
          externalIssueLink={issue ? issue.url : null}
          externalIssueId={issue ? issue.id : null}
          externalIssueKey={issue ? issue.key : null}
          externalIssueDisplayName={issue ? issue.displayName : null}
          onClose={this.deleteIssue.bind(this)}
          integrationType={'clubhouse'}
          integrationName={'clubhouse'}
        />
          <Modal
            show={this.state.showModal}
            onHide={this.closeModal}
            animation={false}
            enforceFocus={false}
            backdrop="static"
          >
            <Modal.Header closeButton>
              <Modal.Title>{'clubhouse issue'}</Modal.Title>
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
                <IssueForm
                  // need the key here so React will re-render
                  // with a new action prop
                  key={action}
                  group={this.props.group}
                  action={action}
                  onSubmitSuccess={this.closeModal}
                />
              )}
            </Modal.Body>
          </Modal>
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
