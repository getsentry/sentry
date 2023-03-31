import {Component} from 'react';

import {t} from 'sentry/locale';
import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import {Group, PlatformExternalIssue, SentryAppInstallation} from 'sentry/types';
import {Event} from 'sentry/types/event';
import getStacktraceBody from 'sentry/utils/getStacktraceBody';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import SentryAppExternalForm, {
  FieldFromSchema,
  SchemaFormConfig,
} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

type Props = {
  action: 'create' | 'link';
  appName: string;
  config: SchemaFormConfig;
  event: Event;
  group: Group;
  onSubmitSuccess: (externalIssue: PlatformExternalIssue) => void;
  sentryAppInstallation: SentryAppInstallation;
};

export class SentryAppExternalIssueForm extends Component<Props> {
  onSubmitSuccess = (issue: PlatformExternalIssue) => {
    ExternalIssueStore.add(issue);
    this.props.onSubmitSuccess(issue);
  };

  getStacktrace() {
    const evt = this.props.event;
    const contentArr = getStacktraceBody(evt);

    if (contentArr && contentArr.length > 0) {
      return '\n\n```\n' + contentArr[0] + '\n```';
    }
    return '';
  }

  getFieldDefault(field: FieldFromSchema) {
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
    return (
      <SentryAppExternalForm
        sentryAppInstallationUuid={this.props.sentryAppInstallation.uuid}
        appName={this.props.appName}
        config={this.props.config}
        action={this.props.action}
        element="issue-link"
        extraFields={{groupId: this.props.group.id}}
        extraRequestBody={{projectId: this.props.group.project.id}}
        onSubmitSuccess={this.onSubmitSuccess}
        // Needs to bind to access this.props
        getFieldDefault={field => this.getFieldDefault(field)}
      />
    );
  }
}

export default SentryAppExternalIssueForm;
