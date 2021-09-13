import {Component} from 'react';

import {t} from 'app/locale';
import ExternalIssueStore from 'app/stores/externalIssueStore';
import {Group, PlatformExternalIssue, SentryAppInstallation} from 'app/types';
import {Event} from 'app/types/event';
import getStacktraceBody from 'app/utils/getStacktraceBody';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import SentryAppExternalForm, {
  Config,
  FieldFromSchema,
} from 'app/views/organizationIntegrations/sentryAppExternalForm';

type Props = {
  group: Group;
  sentryAppInstallation: SentryAppInstallation;
  appName: string;
  config: Config;
  action: 'create' | 'link';
  event: Event;
  onSubmitSuccess: (externalIssue: PlatformExternalIssue) => void;
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
    } else {
      return '';
    }
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
        sentryAppInstallation={this.props.sentryAppInstallation}
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
