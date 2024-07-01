import useLoadGettingStarted from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, ProjectKey} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';

function useLoadReplayOnboardingDoc({
  platform,
  organization,
  projectSlug,
}: {
  organization: Organization;
  platform: PlatformIntegration;
  projectSlug: string;
}) {
  const platformPath =
    platform?.type === 'framework'
      ? platform?.id === 'capacitor'
        ? `capacitor/capacitor`
        : platform?.id.replace(`${platform.language}-`, `${platform.language}/`)
      : `${platform?.language}/${platform?.id}`;

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
    productType: 'replay',
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

export default useLoadReplayOnboardingDoc;
