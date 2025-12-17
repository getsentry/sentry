import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {t} from 'sentry/locale';
import {
  DEFAULT_CODE_REVIEW_TRIGGERS,
  type RepositoryWithSettings,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';
import {type RepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';

interface Props {
  organization: Organization;
  repoWithSettings: RepositoryWithSettings;
}

export default function RepoDetailsForm({organization, repoWithSettings}: Props) {
  const canWrite = useCanWriteSettings();

  return (
    <Form
      allowUndo
      saveOnBlur
      apiMethod="PUT"
      apiEndpoint={`/organizations/${organization.slug}/repos/settings/`}
      initialData={
        {
          enabledCodeReview:
            repoWithSettings?.settings?.enabledCodeReview ??
            organization.autoEnableCodeReview ??
            true,
          codeReviewTriggers:
            repoWithSettings?.settings?.codeReviewTriggers ??
            organization.defaultCodeReviewTriggers ??
            DEFAULT_CODE_REVIEW_TRIGGERS,
          repositoryIds: [repoWithSettings.id],
        } satisfies RepositorySettings
      }
    >
      <JsonForm
        disabled={!canWrite}
        forms={[
          {
            title: t('AI Code Review'),
            fields: [
              {
                name: 'enabledCodeReview',
                label: t('Enable Code Review'),
                help: t('Seer will review your PRs and flag potential bugs.'),
                type: 'boolean',
                getData: data => ({
                  enabledCodeReview: data.enabledCodeReview,
                  repositoryIds: [repoWithSettings.id],
                }),
              },
              {
                name: 'codeReviewTriggers',
                label: t('Code Review Triggers'),
                help: t(
                  'Reviews can run on demand, whenever a PR is opened, or after each commit is pushed to a PR.'
                ),
                type: 'choice',
                multiple: true,
                choices: [
                  ['on_command_phrase', t('On Command Phrase')],
                  ['on_ready_for_review', t('On Ready for Review')],
                  ['on_new_commit', t('On New Commit')],
                ],
                getData: data => ({
                  codeReviewTriggers: data.codeReviewTriggers,
                  repositoryIds: [repoWithSettings.id],
                }),
              },
            ],
          },
        ]}
      />
    </Form>
  );
}
