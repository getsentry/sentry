import {useCallback, useMemo} from 'react';

import {useExternalIssues} from 'sentry/components/group/externalIssuesList/useExternalIssues';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {
  PlatformExternalIssue,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {getStacktraceBody} from 'sentry/utils/getStacktraceBody';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  SentryAppExternalForm,
  type FieldFromSchema,
  type SchemaFormConfig,
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

export function SentryAppExternalIssueForm({
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
  const contentArr = getStacktraceBody({event});
  const isFeedback = (group.issueCategory as string) === 'feedback';
  const feedback = group as unknown as FeedbackIssue;
  const feedbackMessage = group.metadata.message;
  const feedbackEmail = feedback.metadata.contact_email;
  const feedbackName = feedback.metadata.name;
  const feedbackSource = feedback.metadata.source;

  const stackTrace =
    contentArr && contentArr.length > 0 ? '\n\n```\n' + contentArr[0] + '\n```' : '';
  const extraFields = useMemo(() => ({groupId: group.id}), [group.id]);
  const extraRequestBody = useMemo(
    () => ({projectId: group.project.id}),
    [group.project.id]
  );
  const handleSubmitSuccess = useCallback(
    (issue: PlatformExternalIssue) => {
      onCreateExternalIssue(issue);
      onSubmitSuccess(issue);
    },
    [onCreateExternalIssue, onSubmitSuccess]
  );
  const getFieldDefault = useCallback(
    (field: FieldFromSchema) => {
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
          const emailRow = feedbackEmail
            ? `| **contact_email** | ${feedbackEmail} |\n`
            : '';
          const nameRow = feedbackName ? `| **name** | ${feedbackName} |\n` : '';
          const sourceRow = feedbackSource ? `| **source** | ${feedbackSource} |\n` : '';

          return isFeedback
            ? t(
                'Sentry Feedback: [%s](%s)\n\n%s \n\n%s%s%s%s',
                shortId,
                url,
                feedbackMessage,
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
    },
    [
      appName,
      feedbackEmail,
      feedbackMessage,
      feedbackName,
      feedbackSource,
      group.permalink,
      group.shortId,
      group.title,
      isFeedback,
      stackTrace,
    ]
  );

  return (
    <SentryAppExternalForm
      sentryAppInstallationUuid={sentryAppInstallation.uuid}
      appName={appName}
      config={config}
      action={action}
      element="issue-link"
      extraFields={extraFields}
      extraRequestBody={extraRequestBody}
      onSubmitSuccess={handleSubmitSuccess}
      getFieldDefault={getFieldDefault}
    />
  );
}
