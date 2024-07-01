import useLoadGettingStarted from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import type {Organization, PlatformIntegration, ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

function getPlatformPath(platform: PlatformIntegration) {
  if (platform.type === 'framework') {
    switch (platform.id) {
      case 'capacitor':
      case 'ionic':
        return `capacitor/capacitor`;
      case 'dart':
        return `dart/dart`;
      case 'android':
        return `android/android`;
      case 'flutter':
        return `flutter/flutter`;
      case 'unreal':
        return `unreal/unreal`;
      case 'unity':
        return `unity/unity`;
      case 'minidump':
        return `minidump/minidump`;
      case 'native-qt':
        return `native/native-qt`;
      default:
        return platform.id.replace(`${platform.language}-`, `${platform.language}/`);
    }
  }
  if (platform.language === 'apple') {
    switch (platform.id) {
      case 'apple-ios':
        return `apple/ios`;
      case 'apple-macos':
        return `apple/macos`;
      default:
        return `apple/apple`;
    }
  }
  return `${platform.language}/${platform.id}`;
}

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
