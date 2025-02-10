import {useExternalIssues} from 'sentry/components/group/externalIssuesList/useExternalIssues';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {
  PlatformExternalIssue,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import getStacktraceBody from 'sentry/utils/getStacktraceBody';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';
import SentryAppExternalForm from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

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
  const organization = useOrganization();
  const {onCreateExternalIssue} = useExternalIssues({group, organization});
  const contentArr = getStacktraceBody(event);
  const isFeedback = (group.issueCategory as string) === 'feedback';

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
      onSubmitSuccess={(issue: PlatformExternalIssue) => {
        onCreateExternalIssue(issue);
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
          case 'issue.description': {
            const queryParams = {referrer: appName};
            const url = addQueryParamsToExistingUrl(group.permalink, queryParams);
            const shortId = group.shortId;

            const tableHeader = '|  |  |\n| ------------- | --------------- |\n';
            const feedback = group as unknown as FeedbackIssue;
            const email = feedback.metadata.contact_email;
            const name = feedback.metadata.name;
            const source = feedback.metadata.source;
            const emailRow = email ? `| **contact_email** | ${email} |\n` : '';
            const nameRow = name ? `| **name** | ${name} |\n` : '';
            const sourceRow = source ? `| **source** | ${source} |\n` : '';

            return isFeedback
              ? t(
                  'Sentry Feedback: [%s](%s)\n\n%s \n\n%s%s%s%s',
                  shortId,
                  url,
                  group.metadata.message,
                  tableHeader,
                  emailRow,
                  nameRow,
                  sourceRow
                )
              : t('Sentry Issue: [%s](%s)%s', shortId, url, stackTrace);
          }
          default:
            return '';
        }
      }}
    />
  );
}

export default SentryAppExternalIssueForm;
