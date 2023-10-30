import {createStore, StoreDefinition} from 'reflux';

import {Deploy, Organization, Release} from 'sentry/types';

type StoreRelease = Map<string, Release>;
type StoreDeploys = Map<string, Array<Deploy>>;
type StoreLoading = Map<string, boolean>;
type StoreError = Map<string, Error>;

interface ReleaseStoreDefinition extends StoreDefinition {
  get(
    projectSlug: string,
    releaseVersion: string
  ): {
    deploys: Array<Deploy> | undefined;
    deploysError: Error | undefined;
    deploysLoading: boolean | undefined;
    release: Release | undefined;
    releaseError: Error | undefined;
    releaseLoading: boolean | undefined;
  };

  loadDeploys(orgSlug: string, projectSlug: string, releaseVersion: string): void;

  loadDeploysError(projectSlug: string, releaseVersion: string, error: Error): void;
  loadDeploysSuccess(
    projectSlug: string,
    releaseVersion: string,
    data: Deploy[] | null
  ): void;
  loadRelease(orgSlug: string, projectSlug: string, releaseVersion: string): void;
  loadReleaseError(projectSlug: string, releaseVersion: string, error: Error): void;
  loadReleaseSuccess(
    projectSlug: string,
    releaseVersion: string,
    data: Release | null
  ): void;
  reset(): void;
  state: {
    deploys: StoreDeploys;
    deploysError: StoreError;
    deploysLoading: StoreLoading;
    orgSlug: string | undefined;
    release: StoreRelease;
    releaseError: StoreError;
    releaseLoading: StoreLoading;
  };
  updateOrganization(org: Organization): void;
}

export const getReleaseStoreKey = (projectSlug: string, releaseVersion: string) =>
  `${projectSlug}${releaseVersion}`;

const storeConfig: ReleaseStoreDefinition = {
  state: {
    orgSlug: undefined,
    release: new Map() as StoreRelease,
    releaseLoading: new Map() as StoreLoading,
    releaseError: new Map() as StoreError,
    deploys: new Map() as StoreDeploys,
    deploysLoading: new Map() as StoreLoading,
    deploysError: new Map() as StoreError,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {
      orgSlug: undefined,
      release: new Map() as StoreRelease,
      releaseLoading: new Map() as StoreLoading,
      releaseError: new Map() as StoreError,
      deploys: new Map() as StoreDeploys,
      deploysLoading: new Map() as StoreLoading,
      deploysError: new Map() as StoreError,
    };
    this.trigger(this.state);
  },

  updateOrganization(org) {
    this.reset();
    this.state.orgSlug = org.slug;
    this.trigger(this.state);
  },

  loadRelease(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {releaseLoading, releaseError, ...state} = this.state;

    this.state = {
      ...state,
      releaseLoading: {
        ...releaseLoading,
        [releaseKey]: true,
      },
      releaseError: {
        ...releaseError,
        [releaseKey]: undefined,
      },
    };
    this.trigger(this.state);
  },

  loadReleaseError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {releaseLoading, releaseError, ...state} = this.state;

    this.state = {
      ...state,
      releaseLoading: {
        ...releaseLoading,
        [releaseKey]: false,
      },
      releaseError: {
        ...releaseError,
        [releaseKey]: error,
      },
    };
    this.trigger(this.state);
  },

  loadReleaseSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {release, releaseLoading, releaseError, ...state} = this.state;
    this.state = {
      ...state,
      release: {
        ...release,
        [releaseKey]: data,
      },
      releaseLoading: {
        ...releaseLoading,
        [releaseKey]: false,
      },
      releaseError: {
        ...releaseError,
        [releaseKey]: undefined,
      },
    };
    this.trigger(this.state);
  },

  loadDeploys(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {deploysLoading, deploysError, ...state} = this.state;

    this.state = {
      ...state,
      deploysLoading: {
        ...deploysLoading,
        [releaseKey]: true,
      },
      deploysError: {
        ...deploysError,
        [releaseKey]: undefined,
      },
    };
    this.trigger(this.state);
  },

  loadDeploysError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {deploysLoading, deploysError, ...state} = this.state;

    this.state = {
      ...state,
      deploysLoading: {
        ...deploysLoading,
        [releaseKey]: false,
      },
      deploysError: {
        ...deploysError,
        [releaseKey]: error,
      },
    };
    this.trigger(this.state);
  },

  loadDeploysSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {deploys, deploysLoading, deploysError, ...state} = this.state;

    this.state = {
      ...state,
      deploys: {
        ...deploys,
        [releaseKey]: data,
      },
      deploysLoading: {
        ...deploysLoading,
        [releaseKey]: false,
      },
      deploysError: {
        ...deploysError,
        [releaseKey]: undefined,
      },
    };
    this.trigger(this.state);
  },

  get(projectSlug, releaseVersion) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    return {
      release: this.state.release[releaseKey],
      releaseLoading: this.state.releaseLoading[releaseKey],
      releaseError: this.state.releaseError[releaseKey],
      deploys: this.state.deploys[releaseKey],
      deploysLoading: this.state.deploysLoading[releaseKey],
      deploysError: this.state.deploysError[releaseKey],
    };
  },
};

const ReleaseStore = createStore(storeConfig);
export default ReleaseStore;
