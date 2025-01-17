import type {Organization} from 'sentry/types/organization';
import localStorageWrapper from 'sentry/utils/localStorage';

type OverrideState = Record<string, boolean>;

// TODO(ryan953): this should import from the devtoolbar definition
type FlagValue = boolean | string | number | undefined;
export type FeatureFlagMap = Record<string, {override: FlagValue; value: FlagValue}>;

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

  /**
   * Instead of storing the original & overridden values on the org itself we're
   * using this cache instead. Having the cache on the side means we don't need
   * to change the Organization type to add a pr
   */
  private _originalValues = new WeakMap<Organization, FeatureFlagMap>();

  /**
   * Set an override value into localStorage, so that the next time the page
   * loads we can read it and apply it to the org.
   */
  public setStoredOverride(name: string, value: boolean): void {
    try {
      const prev = this._getStoredOverrides();
      const updated: OverrideState = {...prev, [name]: value};
      localStorageWrapper.setItem(LOCALSTORAGE_KEY, JSON.stringify(updated));
    } catch {
      //
    }
  }

  public clear(): void {
    localStorageWrapper.setItem(LOCALSTORAGE_KEY, '{}');
  }

  private _getStoredOverrides(): OverrideState {
    try {
      return JSON.parse(localStorageWrapper.getItem(LOCALSTORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  /**
   * Convert the list of enabled org-features into a FeatureFlapMap and cache it
   * This cached list is only the original values that the server told us, but
   * in a format we can add overrides to later.
   */
  private _getNonOverriddenFeatures(organization: Organization): FeatureFlagMap {
    if (this._originalValues.has(organization)) {
      // @ts-ignore TS(2322): Type 'FeatureFlagMap | undefined' is not assignabl... Remove this comment to see the full error message
      return this._originalValues.get(organization);
    }

    const nonOverriddenFeatures = Object.fromEntries(
      organization.features.map(name => [name, {value: true, override: undefined}])
    );
    this._originalValues.set(organization, nonOverriddenFeatures);
    return nonOverriddenFeatures;
  }

  /**
   * Return the effective featureFlags as a map, for the toolbar
   */
  public getFeatureFlagMap(organization: Organization): FeatureFlagMap {
    const nonOverriddenFeatures = this._getNonOverriddenFeatures(organization);
    const overrides = this._getStoredOverrides();

    const clone: FeatureFlagMap = {...nonOverriddenFeatures};

    for (const [name, override] of Object.entries(overrides)) {
      clone[name] = {value: clone[name]?.value, override};
    }
    return clone;
  }

  /**
   * Return the effective featureFlags as an array, for `organization.features`
   */
  public getEnabledFeatureFlagList(organization: Organization): string[] {
    const nonOverriddenFeatures = this._getNonOverriddenFeatures(organization);
    const overrides = this._getStoredOverrides();

    const names = new Set(Object.keys(nonOverriddenFeatures));

    for (const [name, override] of Object.entries(overrides)) {
      if (override) {
        names.add(name);
      } else {
        names.delete(name);
      }
    }
    return Array.from(names);
  }

  /**
   * Stash the original list of features & override organization.features with the effective list of features
   */
  public loadOrg(organization: Organization) {
    organization.features = this.getEnabledFeatureFlagList(organization);
  }
}
