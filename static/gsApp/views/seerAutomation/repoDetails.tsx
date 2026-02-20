import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';

import AnalyticsArea from 'sentry/components/analyticsArea';
import NotFound from 'sentry/components/errors/notFound';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import RepoDetailsForm from 'getsentry/views/seerAutomation/components/repoDetails/repoDetailsForm';
import RepoProviderIcon from 'getsentry/views/seerAutomation/components/repoProviderIcon';
import useRepositoryWithSettings from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

export default function SeerRepoDetails() {
  const {repoId} = useParams<{repoId: string}>();
  const organization = useOrganization();

  const hasSeer =
    organization.features.includes('seat-based-seer-enabled') ||
    organization.features.includes('seer-added') ||
    organization.features.includes('code-review-beta');

  const {
    data: repoWithSettings,
    error,
    isPending,
    refetch,
  } = useRepositoryWithSettings({
    repositoryId: repoId,
    enabled: hasSeer,
  });

  if (!hasSeer) {
    return (
      <AnalyticsArea name="repo-details">
        <NotFound />
      </AnalyticsArea>
    );
  }

  if (isPending) {
    return (
      <AnalyticsArea name="repo-details">
        <LoadingIndicator />
      </AnalyticsArea>
    );
  }

  if (error) {
    return (
      <AnalyticsArea name="repo-details">
        <LoadingError onRetry={refetch} />
      </AnalyticsArea>
    );
  }

  return (
    <AnalyticsArea name="repo-details">
      <SentryDocumentTitle
        title={t('Repository Seer Settings')}
        projectSlug={repoWithSettings?.name}
      />
      <SettingsPageHeader
        title={tct('Seer Settings for [repoName] [providerLink]', {
          repoName: <code>{repoWithSettings?.name}</code>,
          providerLink: (
            <ExternalLink href={repoWithSettings?.url}>
              <RepoProviderIcon size="md" provider={repoWithSettings?.provider.id} />
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
        <RepoDetailsForm
          organization={organization}
          repoWithSettings={repoWithSettings}
        />
      ) : (
        <Alert variant="warning">{t('Seer is not supported for this repository.')}</Alert>
      )}
    </AnalyticsArea>
  );
}
