import type {Flags} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';

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

  public observeFlags({
    organization,
    bufferSize,
  }: {
    bufferSize: number;
    organization: Organization;
  }) {
    const FLAGS = this.FEATURE_FLAGS;

    // Track names of features that are passed into the .includes() function.
    const handler = {
      apply: function (target, orgFeatures, flagName) {
        // Evaluate the result of .includes()
        const flagResult = target.apply(orgFeatures, flagName);

        // Check if the flag is already in the buffer
        const index = FLAGS.values.findIndex(f => f.flag === flagName[0]);

        // The flag is already in the buffer
        if (index !== -1) {
          FLAGS.values.splice(index, 1);
        }

        // If at capacity, we need to remove the earliest flag
        // This will only happen if not a duplicate flag
        if (FLAGS.values.length === bufferSize) {
          FLAGS.values.shift();
        }

        // Store the flag and its result in the buffer
        FLAGS.values.push({
          flag: flagName[0],
          result: flagResult,
        });

        return flagResult;
      },
    };
    const proxy = new Proxy(organization.features.includes, handler);
    organization.features.includes = proxy;
  }
}
