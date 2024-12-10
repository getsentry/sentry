import type {FeatureFlagContext} from '@sentry/core/build/types/types-hoist/context';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

const FEATURE_FLAG_BUFFER_SIZE = 100;
let __SINGLETON: FeatureObserver | null = null;

export default class FeatureObserver {
  /**
   * Return the same instance of FeatureObserver in each part of the app.
   * Multiple instances of FeatureObserver are needed by tests only.
   */
  public static singleton({
    bufferSize = FEATURE_FLAG_BUFFER_SIZE,
  }: {
    bufferSize?: number;
  }) {
    if (!__SINGLETON) {
      __SINGLETON = new FeatureObserver({bufferSize});
    }
    return __SINGLETON;
  }

  private _bufferSize = 0;
  private FEATURE_FLAGS: FeatureFlagContext = {values: []};

  constructor({bufferSize}: {bufferSize: number}) {
    this._bufferSize = bufferSize;
  }

  /**
   * Return list of recently accessed feature flags.
   */
  public getFeatureFlags() {
    return this.FEATURE_FLAGS;
  }

  public updateFlagBuffer({
    flagName,
    flagResult,
  }: {
    flagName: string;
    flagResult: boolean;
  }) {
    const flagBuffer = this.FEATURE_FLAGS;
    // Check if the flag is already in the buffer
    const index = flagBuffer.values.findIndex(f => f.flag === flagName);

    // The flag is already in the buffer
    if (index !== -1) {
      flagBuffer.values.splice(index, 1);
    }

    // If at capacity, we need to remove the earliest flag
    // This will only happen if not a duplicate flag
    if (flagBuffer.values.length === this._bufferSize) {
      flagBuffer.values.shift();
    }

    // Store the flag and its result in the buffer
    flagBuffer.values.push({
      flag: flagName,
      result: flagResult,
    });
  }

  public observeOrganizationFlags({organization}: {organization: Organization}) {
    // Track names of features that are passed into the .includes() function.
    const handler = {
      apply: (target: any, orgFeatures: string[], flagName: string[]) => {
        // Evaluate the result of .includes()
        const flagResult = target.apply(orgFeatures, flagName);

        // Append `feature.organizations:` in front to match the Sentry options automator format
        const name = 'feature.organizations:' + flagName[0];

        this.updateFlagBuffer({
          flagName: name,
          flagResult,
        });

        return flagResult;
      },
    };
    const proxy = new Proxy(organization.features.includes, handler);
    organization.features.includes = proxy;
  }

  public observeProjectFlags({project}: {project: Project}) {
    // Track names of features that are passed into the .includes() function.
    const handler = {
      apply: (target: any, projFeatures: string[], flagName: string[]) => {
        // Evaluate the result of .includes()
        const flagResult = target.apply(projFeatures, flagName);

        // Append `feature.projects:` in front to match the Sentry options automator format
        const name = 'feature.projects:' + flagName[0];

        this.updateFlagBuffer({
          flagName: name,
          flagResult,
        });

        return flagResult;
      },
    };
    const proxy = new Proxy(project.features.includes, handler);
    project.features.includes = proxy;
  }
}
