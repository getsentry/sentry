import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import PreventAIManageRepos from 'sentry/views/prevent/preventAI/manageRepos';
import PreventAIOnboarding from 'sentry/views/prevent/preventAI/onboarding';

import {usePreventAIOrgRepos} from './usePreventAIOrgRepos';

export default function PreventAIIndex() {
  const {data, isLoading, isError} = usePreventAIOrgRepos();
  const hasAnyInstalledOrgs =
    data?.integrationOrgs?.length && data.integrationOrgs.length > 0;

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

  if (hasAnyInstalledOrgs) {
    return <PreventAIManageRepos installedOrgs={data.integrationOrgs} />;
  }

  return <PreventAIOnboarding />;
}
