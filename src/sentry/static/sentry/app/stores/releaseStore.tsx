import Reflux from 'reflux';

import ReleaseActions from 'app/actions/releaseActions';
import {Deploy, Release} from 'app/types';

type StoreRelease = Map<string, Release>;
type StoreDeploys = Map<string, Array<Deploy>>;
type StoreLoading = Map<string, boolean>;
type StoreError = Map<string, Error>;

type ReleaseStoreInterface = {
  get(
    projectSlug: string,
    releaseVersion: string
  ): {
    release: Release | undefined;
    releaseLoading: boolean | undefined;
    releaseError: Error | undefined;
    deploys: Array<Deploy> | undefined;
    deploysLoading: boolean | undefined;
    deploysError: Error | undefined;
  };

  orgSlug: string | undefined;
  releases: StoreRelease;
  releaseLoading: StoreLoading;
  releaseError: StoreError;
  deploys: StoreDeploys;
  deploysLoading: StoreLoading;
  deploysError: StoreError;

  loadRelease(orgSlug: string, projectSlug: string, releaseVersion: string): void;
  loadReleaseSuccess(projectSlug: string, releaseVersion: string, data: Release): void;
  loadReleaseError(projectSlug: string, releaseVersion: string, error: Error): void;
  loadDeploys(orgSlug: string, projectSlug: string, releaseVersion: string): void;
  loadDeploysSuccess(projectSlug: string, releaseVersion: string, data: Release): void;
  loadDeploysError(projectSlug: string, releaseVersion: string, error: Error): void;
};

export const getReleaseStoreKey = (projectSlug: string, releaseVersion: string) =>
  `${projectSlug}${releaseVersion}`;

const ReleaseStoreConfig: Reflux.StoreDefinition & ReleaseStoreInterface = {
  orgSlug: undefined,
  releases: new Map() as StoreRelease,
  releaseLoading: new Map() as StoreLoading,
  releaseError: new Map() as StoreError,
  deploys: new Map() as StoreDeploys,
  deploysLoading: new Map() as StoreLoading,
  deploysError: new Map() as StoreError,

  listenables: ReleaseActions,

  init() {
    this.resetRelease();
    this.resetDeploys();
  },

  resetRelease(releaseKey?: string) {
    // Reset data for the entire store
    if (!releaseKey) {
      this.orgSlug = undefined;
      this.releases = new Map() as StoreRelease;
      this.releaseLoading = new Map() as StoreLoading;
      this.releaseError = new Map() as StoreError;
      return;
    }

    // Reset data for a release
    this.releases.delete(releaseKey);
    this.releaseLoading.delete(releaseKey);
    this.releaseError.delete(releaseKey);
    this.trigger();
  },

  loadRelease(orgSlug: string, projectSlug: string, releaseVersion: string) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.resetRelease();
      this.orgSlug = orgSlug;
    }

    this.releaseLoading[releaseKey] = true;
    this.trigger();
  },

  loadReleaseError(projectSlug: string, releaseVersion: string, error: Error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    this.releaseLoading[releaseKey] = false;
    this.releaseError[releaseKey] = error;
    this.trigger();
  },

  loadReleaseSuccess(projectSlug: string, releaseVersion: string, data: Release) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    this.releaseLoading[releaseKey] = false;
    this.releaseError[releaseKey] = undefined;
    this.releases[releaseKey] = data;
    this.trigger();
  },

  resetDeploys(releaseKey?: string) {
    // Reset data for the entire store
    if (!releaseKey) {
      this.orgSlug = undefined;
      this.deploys = new Map() as StoreDeploys;
      this.deploysLoading = new Map() as StoreLoading;
      this.deploysError = new Map() as StoreError;
      return;
    }

    // Reset data for a deploy
    this.deploys.delete(releaseKey);
    this.deploysLoading.delete(releaseKey);
    this.deploysError.delete(releaseKey);
  },

  loadDeploys(orgSlug: string, projectSlug: string, releaseVersion: string) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.resetDeploys();
      this.orgSlug = orgSlug;
    }

    this.deploysLoading[releaseKey] = true;
    this.trigger();
  },

  loadDeploysError(projectSlug: string, releaseVersion: string, error: Error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    this.deploysLoading[releaseKey] = false;
    this.deploysError[releaseKey] = error;
    this.trigger();
  },

  loadDeploysSuccess(projectSlug: string, releaseVersion: string, data: Release) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    this.deploysLoading[releaseKey] = false;
    this.deploysError[releaseKey] = undefined;
    this.deploys[releaseKey] = data;
    this.trigger();
  },

  get(projectSlug: string, releaseVersion: string) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

    return {
      release: this.releases[releaseKey],
      releaseLoading: this.releaseLoading[releaseKey],
      releaseError: this.releaseError[releaseKey],
      deploys: this.deploys[releaseKey],
      deploysLoading: this.deploysLoading[releaseKey],
      deploysError: this.deploysError[releaseKey],
    };
  },
};

type ReleaseStore = Reflux.Store & ReleaseStoreInterface;
export default Reflux.createStore(ReleaseStoreConfig) as ReleaseStore;
