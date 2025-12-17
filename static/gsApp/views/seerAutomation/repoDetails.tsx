import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert/alert';
import {LinkButton} from '@sentry/scraps/button/linkButton';

import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconBitbucket} from 'sentry/icons/iconBitbucket';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconGitlab} from 'sentry/icons/iconGitlab';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconVsts} from 'sentry/icons/iconVsts';
import {t, tct} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';
import useRepositoryWithSettings from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

const PROVIDER_ICONS = {
  github: IconGithub,
  'integrations:github': IconGithub,
  'integrations:github_enterprise': IconGithub,
  bitbucket: IconBitbucket,
  'integrations:bitbucket': IconBitbucket,
  visualstudio: IconVsts,
  'integrations:vsts': IconVsts,
  gitlab: IconGitlab,
  'integrations:gitlab': IconGitlab,
};

export default function SeerRepoDetails() {
  const {repoId} = useParams<{repoId: string}>();
  const organization = useOrganization();

  const canWrite = true;

  const {
    data: repoWithSettings,
    error,
    isPending,
    refetch,
  } = useRepositoryWithSettings({repositoryId: repoId});

  const {mutate: mutateRepositorySettings} = useBulkUpdateRepositorySettings();

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <LoadingError onRetry={refetch} />;
  }

  const ProviderIcon =
    PROVIDER_ICONS[repoWithSettings?.provider?.id as keyof typeof PROVIDER_ICONS] ??
    IconOpen;

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Repository Seer Settings')}
        projectSlug={repoWithSettings?.name}
      />
      <SettingsPageHeader
        title={tct('Seer Settings for [repoName] [providerLink]', {
          repoName: <code>{repoWithSettings?.name}</code>,
          providerLink: (
            <ExternalLink href={repoWithSettings?.url}>
              <ProviderIcon size="md" />
            </ExternalLink>
          ),
        })}
        subtitle={t('Choose how Seer automatically reviews your pull requests.')}
        action={
          <LinkButton
            href="https://docs.sentry.io/product/ai-in-sentry/ai-code-review/"
            external
          >
            {t('Read the docs')}
          </LinkButton>
        }
      />

      {isSupportedAutofixProvider(repoWithSettings?.provider) ? (
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint={`/organizations/${organization.slug}/`}
          allowUndo
          initialData={{
            autoEnableCodeReview:
              repoWithSettings?.settings?.enabledCodeReview ??
              organization.autoEnableCodeReview ??
              true,
            defaultCodeReviewTriggers:
              repoWithSettings?.settings?.codeReviewTriggers ??
              organization.defaultCodeReviewTriggers ??
              DEFAULT_CODE_REVIEW_TRIGGERS,
          }}
        >
          <JsonForm
            disabled={!canWrite}
            forms={[
              {
                title: t('AI Code Review'),
                fields: [
                  {
                    name: 'autoEnableCodeReview',
                    label: t('Enable Code Review'),
                    help: t('Seer will review your PRs and flag potential bugs.'),
                    type: 'boolean',
                    onChange: value =>
                      mutateRepositorySettings({
                        enabledCodeReview: value,
                        repositoryIds: [repoId],
                      }),
                  },
                  {
                    name: 'defaultCodeReviewTriggers',
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
                    onChange: value =>
                      mutateRepositorySettings({
                        codeReviewTriggers: value,
                        repositoryIds: [repoId],
                      }),
                  },
                ],
              },
            ]}
          />
        </Form>
      ) : (
        <Alert type="warning">{t('Seer is not supported for this repository.')}</Alert>
      )}
    </Fragment>
  );
}
