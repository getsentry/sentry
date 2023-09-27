import type {ProjectSdkUpdates as TProjectSdkUpdates} from 'sentry/types';

export function ProjectSdkUpdates(
  overrides?: Partial<TProjectSdkUpdates>
): TProjectSdkUpdates {
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
