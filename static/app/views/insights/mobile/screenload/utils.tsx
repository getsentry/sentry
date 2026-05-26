import type {Project} from 'sentry/types/project';

export function isCrossPlatform(project: Project) {
  return project.platform && ['react-native', 'flutter'].includes(project.platform);
}
