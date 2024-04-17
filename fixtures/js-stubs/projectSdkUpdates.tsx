import type {ProjectSdkUpdates} from 'sentry/types/project';

export function ProjectSdkUpdatesFixture(
  overrides?: Partial<ProjectSdkUpdates>
): ProjectSdkUpdates {
  return {
    projectId: '1',
    sdkName: 'sentry.javascript',
    sdkVersion: '7.50.0.',
    suggestions: [
      {
        enables: [],
        newSdkVersion: '7.63.0',
        sdkName: 'sentry.javascript',
        type: 'updateSdk',
      },
    ],
    ...overrides,
  };
}
