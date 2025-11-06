import Feature from 'sentry/components/acl/feature';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import PreventAIManageRepos from 'sentry/views/prevent/preventAI/manageReposPage';
import PreventAIOnboarding from 'sentry/views/prevent/preventAI/onboarding';

import {usePreventAIOrgs} from './hooks/usePreventAIOrgRepos';

function PreventAIContent() {
  const {data, isPending, isError} = usePreventAIOrgs();
  const integratedOrgs = data ?? [];

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
  if (integratedOrgs.length > 0) {
    return <PreventAIManageRepos integratedOrgs={integratedOrgs} />;
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
