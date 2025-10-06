import Feature from 'sentry/components/acl/feature';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import PreventAIManageRepos from 'sentry/views/prevent/preventAI/manageRepos';
import PreventAIOnboarding from 'sentry/views/prevent/preventAI/onboarding';

import {usePreventAIOrgRepos} from './hooks/usePreventAIOrgRepos';

function PreventAIContent() {
  const {data, isLoading, isError} = usePreventAIOrgRepos();
  const orgRepos = data?.orgRepos ?? [];

  if (isLoading) {
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
  if (orgRepos.length > 0) {
    return <PreventAIManageRepos installedOrgs={orgRepos} />;
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
