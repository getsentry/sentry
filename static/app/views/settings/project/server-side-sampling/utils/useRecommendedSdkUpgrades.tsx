import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import useProjects from 'sentry/utils/useProjects';

import {useDistribution} from './useDistribution';
import {useSdkVersions} from './useSdkVersions';

type Props = {
  organization: Organization;
  projectId: Project['id'];
  projectSlug: Project['slug'];
};

export function useRecommendedSdkUpgrades({organization, projectId, projectSlug}: Props) {
  const distribution = useDistribution({
    projectSlug,
    organizationSlug: organization.slug,
  });

  const sdkVersions = useSdkVersions({
    distribution: distribution.data,
    projectId,
    organizationSlug: organization.slug,
  });

  const sdksToUpdate =
    sdkVersions.data?.filter(
      ({isSendingSource, isSendingSampleRate, isSupportedPlatform}) => {
        return (!isSendingSource || !isSendingSampleRate) && isSupportedPlatform;
      }
    ) ?? [];

  const incompatibleSDKs =
    sdkVersions.data?.filter(({isSupportedPlatform}) => !isSupportedPlatform) ?? [];

  const compatibleUpdatedSDKs =
    sdkVersions.data?.filter(
      ({isSendingSource, isSendingSampleRate, isSupportedPlatform}) =>
        isSendingSource && isSendingSampleRate && isSupportedPlatform
    ) ?? [];

  const {projects} = useProjects({
    slugs: [...sdksToUpdate, ...incompatibleSDKs, ...compatibleUpdatedSDKs].map(
      ({project}) => project
    ),
    orgId: organization.slug,
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

  const incompatibleProjects = organization.features.includes(
    'server-side-sampling-allow-incompatible-platforms'
  )
    ? []
    : projects.filter(project =>
        incompatibleSDKs.find(incompatibleSDK => incompatibleSDK.project === project.slug)
      );

  const isProjectIncompatible = incompatibleProjects.some(
    incompatibleProject => incompatibleProject.id === projectId
  );

  const isProjectOnOldSDK = recommendedSdkUpgrades.some(
    recommendedSdkUpgrade => recommendedSdkUpgrade.project.id === projectId
  );

  const compatibleUpdatedProjects = projects.filter(project =>
    compatibleUpdatedSDKs.find(
      compatibleUpdatedSDK => compatibleUpdatedSDK.project === project.slug
    )
  );

  const affectedProjects = [
    ...recommendedSdkUpgrades.map(({project}) => project),
    ...incompatibleProjects,
    ...compatibleUpdatedProjects,
  ];

  return {
    recommendedSdkUpgrades,
    incompatibleProjects,
    affectedProjects,
    loading: sdkVersions.loading || distribution.loading,
    isProjectIncompatible,
    isProjectOnOldSDK,
  };
}
