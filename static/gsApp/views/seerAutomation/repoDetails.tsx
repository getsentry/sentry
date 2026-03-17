import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {NotFound} from 'sentry/components/errors/notFound';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {RepoDetailsForm} from 'getsentry/views/seerAutomation/components/repoDetails/repoDetailsForm';
import {SeerSettingsPageWrapper} from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import {useRepositoryWithSettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

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
      <SeerSettingsPageWrapper>
        <SentryDocumentTitle title={t('Code Review for %s', repoWithSettings?.name)} />
        <SettingsPageHeader
          title={
            <Flex align="baseline" gap="md">
              {tct('Code Review for [repoName] [providerLink]', {
                repoName: (
                  <Text as="span" monospace>
                    {repoWithSettings?.name}
                  </Text>
                ),
                providerLink: (
                  <ExternalLink href={repoWithSettings?.url}>
                    <RepoProviderIcon
                      size="md"
                      provider={repoWithSettings?.provider.id}
                    />
                  </ExternalLink>
                ),
              })}
            </Flex>
          }
          subtitle={tct(
            'Choose how Seer automatically reviews your pull requests. [docs:Read the docs] to learn what Seer can do.',
            {
              docs: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/code-review/" />
              ),
            }
          )}
        />
        {isSupportedAutofixProvider(repoWithSettings?.provider) ? (
          <RepoDetailsForm
            organization={organization}
            repoWithSettings={repoWithSettings}
          />
        ) : (
          <Alert variant="warning">
            {t('Seer is not supported for this repository.')}
          </Alert>
        )}
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
