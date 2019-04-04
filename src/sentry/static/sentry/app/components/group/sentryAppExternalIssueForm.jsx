import React from 'react';
import PropTypes from 'prop-types';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import ExternalIssueStore from 'app/stores/externalIssueStore';

class SentryAppExternalIssueForm extends React.Component {
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

  onSubmitError = () => {
    const {action} = this.props;
    const appName = this.props.sentryAppInstallation.sentryApp.name;
    addErrorMessage(t('Unable to %s %s issue.', action, appName));
  };

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
        const queryParams = {referrer: this.props.sentryAppInstallation.sentryApp.name};
        const url = addQueryParamsToExistingUrl(group.permalink, queryParams);
        const shortId = group.shortId;
        return t('Sentry Issue: [%s](%s)', shortId, url);
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
            />
          );
        })}
      </Form>
    );
  }
}

export default SentryAppExternalIssueForm;
