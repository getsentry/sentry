import useLoadGettingStarted from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import type {Organization, PlatformIntegration, ProjectKey} from 'sentry/types';
import {getPlatformPath} from 'sentry/utils/gettingStartedDocs/getPlatformPath';
import {useApiQuery} from 'sentry/utils/queryClient';

function useLoadFeedbackOnboardingDoc({
  platform,
  organization,
  projectSlug,
}: {
  organization: Organization;
  platform: PlatformIntegration;
  projectSlug: string;
}) {
  const platformPath = getPlatformPath(platform);

  const {
    data: projectKeys,
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });
  const module = useLoadGettingStarted({
    platformId: platform.id,
    platformPath,
    productType: 'feedback',
  });

  if (module === 'none') {
    return {
      docs: null,
    };
  }

  if (!module || projectKeysIsLoading) {
    return {
      isProjKeysLoading: true,
    };
  }

  if (projectKeysIsError) {
    return {
      isProjKeysError: true,
    };
  }

  const {default: docs} = module;

  return {
    docs,
    dsn: projectKeys[0].dsn.public,
    cdn: projectKeys[0].dsn.cdn,
  };
}

export default useLoadFeedbackOnboardingDoc;
