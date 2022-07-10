import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  orgSlug: Organization['slug'];
};

export function useRecommendedSdkUpgrades({orgSlug}: Props) {
  const {samplingSdkVersions} = useLegacyStore(ServerSideSamplingStore);

  const notSendingSampleRateSdkUpgrades = samplingSdkVersions.filter(
    samplingSdkVersion => !samplingSdkVersion.isSendingSampleRate
  );

  const {projects} = useProjects({
    slugs: notSendingSampleRateSdkUpgrades.map(sdkUpgrade => sdkUpgrade.project),
    orgId: orgSlug,
  });

  const recommendedSdkUpgrades = projects
    .map(upgradeSDKfromProject => {
      const sdkInfo = notSendingSampleRateSdkUpgrades.find(
        notSendingSampleRateSdkUpgrade =>
          notSendingSampleRateSdkUpgrade.project === upgradeSDKfromProject.slug
      );

      if (!sdkInfo) {
        return undefined;
      }

      return {
        project: upgradeSDKfromProject,
        latestSDKName: sdkInfo.latestSDKName,
        latestSDKVersion: sdkInfo.latestSDKVersion,
      };
    })
    .filter(defined);

  return {recommendedSdkUpgrades};
}
