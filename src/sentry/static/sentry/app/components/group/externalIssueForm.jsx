import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import queryString from 'query-string';
import {debounce} from 'lodash';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import ExternalIssueStore from 'app/stores/externalIssueStore';

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

  shouldRenderBadRequests = true;

  getEndpoints() {
    const {group, integration, action} = this.props;
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
    const {dynamicFieldValues} = this.state;
    const {action, group, integration} = this.props;
    const endpoint = `/groups/${group.id}/integrations/${integration.id}/`;
    const query = {action, ...dynamicFieldValues};

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
    const {action} = this.props;
    const config = integrationDetails[`${action}IssueConfig`];

    return config
      .filter(field => field.updatesForm)
      .reduce((a, field) => ({...a, [field.name]: field.default}), {});
  }

  onFieldChange = (label, value) => {
    const dynamicFields = this.getDynamicFields();
    if (label in dynamicFields) {
      const dynamicFieldValues = this.state.dynamicFieldValues || {};
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
    const {integrationDetails} = this.state;
    const {action, group, integration} = this.props;
    const config = integrationDetails[`${action}IssueConfig`];

    const initialData = {};
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
            key={`${field.name}-${field.default}`}
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

export class SentryAppExternalIssueForm extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    sentryAppInstallation: PropTypes.object,
    config: PropTypes.object.isRequired,
    action: PropTypes.oneOf(['link', 'create']),
    onSubmitSuccess: PropTypes.func,
  };

  onSubmitSuccess = issue => {
    ExternalIssueStore.add(issue);
    this.props.onSubmitSuccess(issue);
  };

  render() {
    const {sentryAppInstallation} = this.props;
    const config = this.props.config[this.props.action];
    const requiredFields = config.required_fields || [];
    const optionalFields = config.optional_fields || [];

    if (!sentryAppInstallation) {
      return '';
    }

    return (
      <Form
        apiEndpoint={`/sentry-app-installations/${sentryAppInstallation.uuid}/external-issues/`}
        apiMethod="POST"
        onSubmitSuccess={this.onSubmitSuccess}
        initialData={{
          action: this.props.action,
          groupId: this.props.group.id,
          uri: config.uri,
        }}
      >
        {requiredFields.map(field => {
          field.choices = field.choices || [];

          return (
            <FieldFromConfig
              key={`${field.name}`}
              field={field}
              inline={false}
              stacked
              flexibleControlStateSize
              required={true}
            />
          );
        })}

        {optionalFields.map(field => {
          field.choices = field.choices || [];

          return (
            <FieldFromConfig
              key={`${field.name}`}
              field={field}
              inline={false}
              stacked
              flexibleControlStateSize
            />
          );
        })}
      </Form>
    );
  }
}

export default ExternalIssueForm;
