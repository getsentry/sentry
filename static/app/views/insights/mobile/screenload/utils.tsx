import type {Project} from 'sentry/types/project';
import {isReactNativePlatform} from 'sentry/utils/platform';

export function isCrossPlatform(project: Project) {
  return (
    project.platform &&
    (isReactNativePlatform(project.platform) || project.platform === 'flutter')
  );
}
