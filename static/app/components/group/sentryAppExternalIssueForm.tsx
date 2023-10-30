import {t} from 'sentry/locale';
import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import {Group, PlatformExternalIssue, SentryAppInstallation} from 'sentry/types';
import {Event} from 'sentry/types/event';
import getStacktraceBody from 'sentry/utils/getStacktraceBody';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import SentryAppExternalForm, {
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

function SentryAppExternalIssueForm({
  action,
  appName,
  config,
  event,
  group,
  onSubmitSuccess,
  sentryAppInstallation,
}: Props) {
  const contentArr = getStacktraceBody(event);

  const stackTrace =
    contentArr && contentArr.length > 0 ? '\n\n```\n' + contentArr[0] + '\n```' : '';

  return (
    <SentryAppExternalForm
      sentryAppInstallationUuid={sentryAppInstallation.uuid}
      appName={appName}
      config={config}
      action={action}
      element="issue-link"
      extraFields={{groupId: group.id}}
      extraRequestBody={{projectId: group.project.id}}
      onSubmitSuccess={issue => {
        ExternalIssueStore.add(issue);
        onSubmitSuccess(issue);
      }}
      // Needs to bind to access this.props
      getFieldDefault={field => {
        if (field.type === 'textarea') {
          field.maxRows = 10;
          field.autosize = true;
        }
        switch (field.default) {
          case 'issue.title':
            return group.title;
          case 'issue.description':
            const queryParams = {referrer: appName};
            const url = addQueryParamsToExistingUrl(group.permalink, queryParams);
            const shortId = group.shortId;
            return t('Sentry Issue: [%s](%s)%s', shortId, url, stackTrace);
          default:
            return '';
        }
      }}
    />
  );
}

export default SentryAppExternalIssueForm;
