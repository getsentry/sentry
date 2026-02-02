import uniqBy from 'lodash/uniqBy';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {ProjectSdkUpdates} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {semverCompare} from 'sentry/utils/versions/semverCompare';
import {MIN_SDK_VERSION_BY_PLATFORM} from 'sentry/views/insights/database/settings';

interface Options {
  enabled: boolean;
  projectId: string[];
}

/**
 * Returns a list of projects that are not eligible for span metrics
 * due to SDK requirements.
 */
export function useOutdatedSDKProjects({enabled, projectId}: Options) {
  const organization = useOrganization();
  const response = useApiQuery<ProjectSdkUpdates[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sdk-updates/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {project: projectId}},
    ],
    {staleTime: 5000, enabled}
  );
  const {data: availableUpdates} = response;

  const projects = (availableUpdates ?? [])
    .filter(update => {
      const platform = removeFlavorFromSDKName(update.sdkName);
      const minimumRequiredVersion = MIN_SDK_VERSION_BY_PLATFORM[platform];

      if (!minimumRequiredVersion) {
        // If a minimum version is not specified, assume that the platform
        // doesn't have any support at all
        return true;
      }

      return semverCompare(update.sdkVersion, minimumRequiredVersion) === -1;
    })
    .map(update => ProjectsStore.getById(update.projectId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    ...response,
    projects: uniqBy(projects, 'id'),
  };
}

/**
 * Strips the SDK flavour from its name
 *
 * @param sdkName Name of the SDK, like `"sentry.javascript.react"
 * @returns Platform name like `"sentry.javascript"`
 */
function removeFlavorFromSDKName(sdkName: string): string {
  return sdkName.split('.').slice(0, 2).join('.');
}
