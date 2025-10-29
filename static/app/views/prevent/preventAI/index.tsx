import Feature from 'sentry/components/acl/feature';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import PreventAIManageRepos from 'sentry/views/prevent/preventAI/manageRepos';
import PreventAIOnboarding from 'sentry/views/prevent/preventAI/onboarding';

function PreventAIContent() {
  const organization = useOrganization();

  // Check if there are any GitHub integrations installed
  const {
    data: githubIntegrations = [],
    isPending,
    isError,
  } = useApiQuery<OrganizationIntegration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return (
      <LoadingError
        message={t('Unable to load Prevent AI setup status.')}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (githubIntegrations.length > 0) {
    return <PreventAIManageRepos installedOrgs={[]} />;
  }
  return <PreventAIOnboarding />;
}

export default function PreventAIIndex() {
  return (
    <Feature
      features={['organizations:prevent-ai-configure']}
      renderDisabled={() => <PreventAIOnboarding />}
    >
      <PreventAIContent />
    </Feature>
  );
}
