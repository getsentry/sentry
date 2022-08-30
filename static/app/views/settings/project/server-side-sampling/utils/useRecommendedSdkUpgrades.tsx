import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  orgSlug: Organization['slug'];
  projectId: Project['id'];
};

export function useRecommendedSdkUpgrades({orgSlug, projectId}: Props) {
  const {sdkVersions} = useLegacyStore(ServerSideSamplingStore);
  const {data = [], loading} = sdkVersions;

  const sdksToUpdate = data.filter(
    ({isSendingSource, isSendingSampleRate, isSupportedPlatform}) => {
      return (!isSendingSource || !isSendingSampleRate) && isSupportedPlatform;
    }
  );

  const incompatibleSDKs = data.filter(({isSupportedPlatform}) => !isSupportedPlatform);

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

  const isProjectIncompatible = incompatibleProjects.some(
    incompatibleProject => incompatibleProject.id === projectId
  );

  const affectedProjects = [
    ...recommendedSdkUpgrades.map(({project}) => project),
    ...incompatibleProjects,
  ];

  return {
    recommendedSdkUpgrades,
    incompatibleProjects,
    affectedProjects,
    loading,
    isProjectIncompatible,
  };
}
