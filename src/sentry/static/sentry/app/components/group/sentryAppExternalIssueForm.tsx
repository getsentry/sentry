import React from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import ExternalIssueStore from 'app/stores/externalIssueStore';
import getStacktraceBody from 'app/utils/getStacktraceBody';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Group, PlatformExternalIssue, Event, SentryAppInstallation} from 'app/types';
import {Field} from 'app/views/settings/components/forms/type';

type Props = {
  api: Client;
  group: Group;
  sentryAppInstallation: SentryAppInstallation;
  appName: string;
  config: object;
  action: 'create' | 'link';
  event: Event;
  onSubmitSuccess: (externalIssue: PlatformExternalIssue) => void;
};

//TODO(TS): Improve typings on Field so we can use the type in functions without errors

export class SentryAppExternalIssueForm extends React.Component<Props> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    sentryAppInstallation: PropTypes.object,
    appName: PropTypes.string,
    config: PropTypes.object.isRequired,
    action: PropTypes.oneOf(['link', 'create']),
    event: SentryTypes.Event,
    onSubmitSuccess: PropTypes.func,
  };

  onSubmitSuccess = (issue: PlatformExternalIssue) => {
    ExternalIssueStore.add(issue);
    this.props.onSubmitSuccess(issue);
  };

  onSubmitError = () => {
    const {action, appName} = this.props;
    addErrorMessage(t('Unable to %s %s issue.', action, appName));
  };

  getOptions = (field: Field, input: string) => {
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
          loadOptions: (input: string) => this.getOptions(field, input),
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

    if (contentArr && contentArr.length > 0) {
      return '\n\n```\n' + contentArr[0] + '\n```';
    } else {
      return '';
    }
  }

  getFieldDefault(field) {
    const {group, appName} = this.props;
    if (field.type === 'textarea') {
      field.maxRows = 10;
      field.autosize = true;
    }
    switch (field.default) {
      case 'issue.title':
        return group.title;
      case 'issue.description':
        const stacktrace = this.getStacktrace();
        const queryParams = {referrer: appName};
        const url = addQueryParamsToExistingUrl(group.permalink, queryParams);
        const shortId = group.shortId;
        return t('Sentry Issue: [%s](%s)%s', shortId, url, stacktrace);
      default:
        return '';
    }
  }

  render() {
    const {sentryAppInstallation, action} = this.props;
    const config = this.props.config[action];

    const requiredFields = config.required_fields || [];
    const optionalFields = config.optional_fields || [];
    const metaFields: Field[] = [
      {
        type: 'hidden',
        name: 'action',
        defaultValue: action,
      },
      {
        type: 'hidden',
        name: 'groupId',
        defaultValue: this.props.group.id,
      },
      {
        type: 'hidden',
        name: 'uri',
        defaultValue: config.uri,
      },
    ];

    if (!sentryAppInstallation) {
      return '';
    }

    return (
      <Form
        key={action}
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
          field = Object.assign({}, field, {
            choices: field.choices || [],
            inline: false,
            stacked: true,
            flexibleControlStateSize: true,
            required: true,
          });

          if (['text', 'textarea'].includes(field.type) && field.default) {
            field.defaultValue = this.getFieldDefault(field);
          }

          return (
            <FieldFromConfig
              key={`${field.name}`}
              field={field}
              {...this.fieldProps(field)}
            />
          );
        })}

        {optionalFields.map(field => {
          field = Object.assign({}, field, {
            choices: field.choices || [],
            inline: false,
            stacked: true,
            flexibleControlStateSize: true,
          });

          if (['text', 'textarea'].includes(field.type) && field.default) {
            field.defaultValue = this.getFieldDefault(field);
          }

          return (
            <FieldFromConfig
              key={`${field.name}`}
              field={field}
              {...this.fieldProps(field)}
            />
          );
        })}
      </Form>
    );
  }
}

export default withApi(SentryAppExternalIssueForm);
