import type {Flags} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

let __SINGLETON: FeatureObserver | null = null;

export default class FeatureObserver {
  /**
   * Return the same instance of FeatureObserver in each part of the app.
   * Multiple instances of FeatureObserver are needed by tests only.
   */
  public static singleton() {
    if (!__SINGLETON) {
      __SINGLETON = new FeatureObserver();
    }
    return __SINGLETON;
  }

  private FEATURE_FLAGS: Flags = {values: []};

  /**
   * Return list of recently accessed feature flags.
   */
  public getFeatureFlags() {
    return this.FEATURE_FLAGS;
  }

  public updateFlagBuffer({
    flagName,
    flagResult,
    bufferSize,
    flagBuffer,
  }: {
    bufferSize: number;
    flagBuffer: Flags;
    flagName: any;
    flagResult: any;
  }) {
    // Check if the flag is already in the buffer
    const index = flagBuffer.values.findIndex(f => f.flag === flagName);

    // The flag is already in the buffer
    if (index !== -1) {
      flagBuffer.values.splice(index, 1);
    }

    // If at capacity, we need to remove the earliest flag
    // This will only happen if not a duplicate flag
    if (flagBuffer.values.length === bufferSize) {
      flagBuffer.values.shift();
    }

    // Store the flag and its result in the buffer
    flagBuffer.values.push({
      flag: flagName,
      result: flagResult,
    });
  }

  public observeOrganizationFlags({
    organization,
    bufferSize,
  }: {
    bufferSize: number;
    organization: Organization;
  }) {
    const flagBuffer = this.FEATURE_FLAGS;
    const updateFlagBuffer = this.updateFlagBuffer;
    // Track names of features that are passed into the .includes() function.
    const handler = {
      apply: function (target, orgFeatures, flagName) {
        // Evaluate the result of .includes()
        const flagResult = target.apply(orgFeatures, flagName);

        // Append `feature.organizations:` in front to match the Sentry options automator format
        const name = 'feature.organizations:' + flagName[0];

        updateFlagBuffer({flagName: name, flagResult, bufferSize, flagBuffer});

        return flagResult;
      },
    };
    const proxy = new Proxy(organization.features.includes, handler);
    organization.features.includes = proxy;
  }

  public observeProjectFlags({
    project,
    bufferSize,
  }: {
    bufferSize: number;
    project: Project;
  }) {
    const flagBuffer = this.FEATURE_FLAGS;
    const updateFlagBuffer = this.updateFlagBuffer;
    // Track names of features that are passed into the .includes() function.
    const handler = {
      apply: function (target, projFeatures, flagName) {
        // Evaluate the result of .includes()
        const flagResult = target.apply(projFeatures, flagName);

        // Append `feature.projects:` in front to match the Sentry options automator format
        const name = 'feature.projects:' + flagName[0];

        updateFlagBuffer({flagName: name, flagResult, bufferSize, flagBuffer});

        return flagResult;
      },
    };
    const proxy = new Proxy(project.features.includes, handler);
    project.features.includes = proxy;
  }
}
