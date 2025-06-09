import type {FlagMap} from '@sentry/toolbar';

import type {Organization} from 'sentry/types/organization';
import localStorageWrapper from 'sentry/utils/localStorage';

type OverrideState = Record<string, boolean>;

const LOCALSTORAGE_KEY = 'feature-flag-overrides';

let __SINGLETON: FeatureFlagOverrides | null = null;

export default class FeatureFlagOverrides {
  /**
   * Return the same instance of FeatureFlagOverrides in each part of the app.
   *
   * Multiple instances of FeatureFlagOverrides are needed by tests only.
   */
  public static singleton() {
    if (!__SINGLETON) {
      __SINGLETON = new FeatureFlagOverrides();
    }
    return __SINGLETON;
  }

  public getFlagMap(organization: Organization): FlagMap {
    return Object.fromEntries(organization.features.map(name => [name, true]));
  }

  /**
   * Set an override value into localStorage, so that the next time the page
   * loads we can read it and apply it to the org.
   */
  public setStoredOverride(name: string, value: boolean): void {
    try {
      const prev = this.getStoredOverrides();
      const updated: OverrideState = {...prev, [name]: value};
      localStorageWrapper.setItem(LOCALSTORAGE_KEY, JSON.stringify(updated));
    } catch {
      //
    }
  }

  public clear(): void {
    localStorageWrapper.setItem(LOCALSTORAGE_KEY, '{}');
  }

  public getStoredOverrides(): OverrideState {
    try {
      return JSON.parse(localStorageWrapper.getItem(LOCALSTORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  /**
   * Return the effective featureFlags as an array, for `organization.features`
   */
  public getEnabledFeatureFlagList(organization: Organization): string[] {
    const enabled = new Set(Object.keys(this.getFlagMap(organization)));
    Object.entries(this.getStoredOverrides()).forEach(([override, value]) => {
      // TODO(ryan953): we're only dealing with booleans to start, but other types could be supported
      if (value === true) {
        enabled.add(override);
      } else if (value === false) {
        enabled.delete(override);
      }
    });
    return Array.from(enabled);
  }

  /**
   * Stash the original list of features & override organization.features with the effective list of features
   */
  public loadOrg(organization: Organization) {
    organization.features = this.getEnabledFeatureFlagList(organization);
  }
}
