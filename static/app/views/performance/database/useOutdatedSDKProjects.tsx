import uniqBy from 'lodash/uniqBy';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useOrganizationSDKUpdates} from 'sentry/utils/useOrganizationSDKUpdates';
import {semverCompare} from 'sentry/utils/versions';
import {MIN_SDK_VERSION_BY_PLATFORM} from 'sentry/views/performance/database/settings';

interface Options {
  enabled?: boolean;
  projectId?: string[];
}

/**
 * Returns a list of projects that are not eligible for span metrics
 * due to SDK requirements.
 *
 * @param options Additional options
 * @param options.projectId List of project IDs to check against. If omitted, checks all organization projects
 * @returns List of projects
 */
export function useOutdatedSDKProjects(options?: Options) {
  const response = useOrganizationSDKUpdates(options ?? {});
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
    .map(update => update.projectId)
    .map(projectId => {
      return ProjectsStore.getById(projectId);
    })
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
