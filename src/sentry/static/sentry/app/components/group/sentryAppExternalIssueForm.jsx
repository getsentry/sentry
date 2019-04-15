import React from 'react';
import PropTypes from 'prop-types';
import {debounce} from 'lodash';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import ExternalIssueStore from 'app/stores/externalIssueStore';
import getStacktraceBody from 'app/utils/getStacktraceBody';
import withApi from 'app/utils/withApi';

class SentryAppExternalIssueForm extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    sentryAppInstallation: PropTypes.object,
    config: PropTypes.object.isRequired,
    action: PropTypes.oneOf(['link', 'create']),
    event: SentryTypes.Event,
    onSubmitSuccess: PropTypes.func,
  };

  onSubmitSuccess = issue => {
    ExternalIssueStore.add(issue);
    this.props.onSubmitSuccess(issue);
  };

  onSubmitError = () => {
    const {action} = this.props;
    const appName = this.props.sentryAppInstallation.sentryApp.name;
    addErrorMessage(t('Unable to %s %s issue.', action, appName));
  };

  getOptions = (field, input) => {
    return new Promise(resolve => {
      this.debouncedOptionLoad(field, input, resolve);
    });
  };

  debouncedOptionLoad = debounce(
    // debounce is used to prevent making a request for every input change and
    // instead makes the requests every 200ms
    (field, input, resolve) => {
      const install = this.props.sentryAppInstallation;
      const projectId = this.props.group.project.id;

      this.props.api
        .requestPromise(`/sentry-app-installations/${install.uuid}/external-requests/`, {
          query: {
            projectId,
            uri: field.uri,
            query: input,
          },
        })
        .then(data => {
          const options = (data.choices || []).map(([value, label]) => ({value, label}));
          return resolve({options});
        });
    },
    200,
    {trailing: true}
  );

  fieldProps = field => {
    return field.uri
      ? {
          loadOptions: input => this.getOptions(field, input),
          async: true,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: false,
        }
      : {};
  };

  getStacktrace() {
    const evt = this.props.event;
    const contentArr = getStacktraceBody(evt);

    if (contentArr[0]) {
      return '\n\n```\n' + contentArr[0] + '\n```';
    } else {
      return '';
    }
  }

  getFieldDefault(field) {
    const {group} = this.props;
    if (field.type == 'textarea') {
      field.maxRows = 10;
      field.autosize = true;
    }
    switch (field.default) {
      case 'issue.title':
        return group.title;
      case 'issue.description':
        const stacktrace = this.getStacktrace();
        const queryParams = {referrer: this.props.sentryAppInstallation.sentryApp.name};
        const url = addQueryParamsToExistingUrl(group.permalink, queryParams);
        const shortId = group.shortId;
        return t('Sentry Issue: [%s](%s)%s', shortId, url, stacktrace);
      default:
        return '';
    }
  }

  render() {
    const {sentryAppInstallation} = this.props;
    const config = this.props.config[this.props.action];

    const requiredFields = config.required_fields || [];
    const optionalFields = config.optional_fields || [];
    const metaFields = [
      {
        type: 'hidden',
        name: 'action',
        value: this.props.action,
        defaultValue: this.props.action,
      },
      {
        type: 'hidden',
        name: 'groupId',
        value: this.props.group.id,
        defaultValue: this.props.group.id,
      },
      {
        type: 'hidden',
        name: 'uri',
        value: config.uri,
        defaultValue: config.uri,
      },
    ];

    if (!sentryAppInstallation) {
      return '';
    }

    return (
      <Form
        key={this.props.action}
        apiEndpoint={`/sentry-app-installations/${
          sentryAppInstallation.uuid
        }/external-issues/`}
        apiMethod="POST"
        onSubmitSuccess={this.onSubmitSuccess}
        onSubmitError={this.onSubmitError}
      >
        {metaFields.map(field => {
          return <FieldFromConfig key={field.name} field={field} />;
        })}

        {requiredFields.map(field => {
          field.choices = field.choices || [];

          if (['text', 'textarea'].includes(field.type) && field.default) {
            field.defaultValue = this.getFieldDefault(field);
          }

          return (
            <FieldFromConfig
              key={`${field.name}`}
              field={field}
              inline={false}
              stacked
              flexibleControlStateSize
              required={true}
              {...this.fieldProps(field)}
            />
          );
        })}

        {optionalFields.map(field => {
          field.choices = field.choices || [];

          if (['text', 'textarea'].includes(field.type) && field.default) {
            field.defaultValue = this.getFieldDefault(field);
          }

          return (
            <FieldFromConfig
              key={`${field.name}`}
              field={field}
              inline={false}
              stacked
              flexibleControlStateSize
              {...this.fieldProps(field)}
            />
          );
        })}
      </Form>
    );
  }
}

export {SentryAppExternalIssueForm};
export default withApi(SentryAppExternalIssueForm);
