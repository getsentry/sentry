import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  orgSlug: Organization['slug'];
};

export function useRecommendedSdkUpgrades({orgSlug}: Props) {
  const {samplingSdkVersions, fetching} = useLegacyStore(ServerSideSamplingStore);

  const sdksToUpdate = samplingSdkVersions.filter(
    ({isSendingSource, isSendingSampleRate, isSupportedPlatform}) => {
      return (!isSendingSource || !isSendingSampleRate) && isSupportedPlatform;
    }
  );

  const incompatibleSDKs = samplingSdkVersions.filter(
    ({isSupportedPlatform}) => !isSupportedPlatform
  );

  const {projects} = useProjects({
    slugs: [...sdksToUpdate, ...incompatibleSDKs].map(({project}) => project),
    orgId: orgSlug,
  });

  const recommendedSdkUpgrades = projects
    .map(project => {
      const sdkInfo = sdksToUpdate.find(
        sdkToUpdate => sdkToUpdate.project === project.slug
      );

      if (!sdkInfo) {
        return undefined;
      }

      return {
        project,
        latestSDKName: sdkInfo.latestSDKName,
        latestSDKVersion: sdkInfo.latestSDKVersion,
      };
    })
    .filter(defined);

  const incompatibleProjects = projects.filter(project =>
    incompatibleSDKs.find(incompatibleSDK => incompatibleSDK.project === project.slug)
  );

  return {recommendedSdkUpgrades, incompatibleProjects, fetching};
}
