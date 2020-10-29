import Reflux from 'reflux';

import ReleaseActions from 'app/actions/releaseActions';
import OrganizationActions from 'app/actions/organizationActions';
import {Deploy, Organization, Release} from 'app/types';

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

  state: {
    orgSlug: string | undefined;
    release: StoreRelease;
    releaseLoading: StoreLoading;
    releaseError: StoreError;
    deploys: StoreDeploys;
    deploysLoading: StoreLoading;
    deploysError: StoreError;
  };

  updateOrganization(org: Organization): void;
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
  state: {
    orgSlug: undefined,
    release: new Map() as StoreRelease,
    releaseLoading: new Map() as StoreLoading,
    releaseError: new Map() as StoreError,
    deploys: new Map() as StoreDeploys,
    deploysLoading: new Map() as StoreLoading,
    deploysError: new Map() as StoreError,
  },

  listenables: ReleaseActions,

  init() {
    this.listenTo(OrganizationActions.update, this.updateOrganization);
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

  updateOrganization(org: Organization) {
    this.reset();
    this.state.orgSlug = org.slug;
    this.trigger(this.state);
  },

  loadRelease(orgSlug: string, projectSlug: string, releaseVersion: string) {
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

  loadReleaseError(projectSlug: string, releaseVersion: string, error: Error) {
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

  loadReleaseSuccess(projectSlug: string, releaseVersion: string, data: Release) {
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

  loadDeploys(orgSlug: string, projectSlug: string, releaseVersion: string) {
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

  loadDeploysError(projectSlug: string, releaseVersion: string, error: Error) {
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

  loadDeploysSuccess(projectSlug: string, releaseVersion: string, data: Release) {
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

  get(projectSlug: string, releaseVersion: string) {
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

type ReleaseStore = Reflux.Store & ReleaseStoreInterface;
export default Reflux.createStore(ReleaseStoreConfig) as ReleaseStore;
