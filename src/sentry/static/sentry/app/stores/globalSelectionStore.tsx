import Reflux from 'reflux';
import isEqual from 'lodash/isEqual';

import {GlobalSelection, Organization} from 'app/types';
import {LOCAL_STORAGE_KEY} from 'app/constants/globalSelectionHeader';
import {getDefaultSelection} from 'app/components/organizations/globalSelectionHeader/utils';
import {isEqualWithDates} from 'app/utils/isEqualWithDates';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';
import OrganizationsStore from 'app/stores/organizationsStore';
import localStorage from 'app/utils/localStorage';

type UpdateData = {
  project: number[];
  environment: string[];
};

type StoreState = {
  selection: GlobalSelection;
  isReady: boolean;
};

type GlobalSelectionStoreInterface = {
  state: GlobalSelection;

  reset: (state?: GlobalSelection) => void;
  onReset: () => void;
  isReady: () => boolean;
  onSetOrganization: (organization: Organization) => void;
  onInitializeUrlState: (newSelection: GlobalSelection) => void;
  get: () => StoreState;
  updateProjects: (
    projects: GlobalSelection['projects'],
    environments: null | string[]
  ) => void;
  updateDateTime: (datetime: GlobalSelection['datetime']) => void;
  updateEnvironments: (environments: string[]) => void;
  onSave: (data: UpdateData) => void;
};

type GlobalSelectionStore = Reflux.Store & GlobalSelectionStoreInterface;

const storeConfig: Reflux.StoreDefinition & GlobalSelectionStoreInterface = {
  state: getDefaultSelection(),

  init() {
    this.reset(this.state);
    this.listenTo(GlobalSelectionActions.reset, this.onReset);
    this.listenTo(GlobalSelectionActions.initializeUrlState, this.onInitializeUrlState);
    this.listenTo(GlobalSelectionActions.setOrganization, this.onSetOrganization);
    this.listenTo(GlobalSelectionActions.save, this.onSave);
    this.listenTo(GlobalSelectionActions.updateProjects, this.updateProjects);
    this.listenTo(GlobalSelectionActions.updateDateTime, this.updateDateTime);
    this.listenTo(GlobalSelectionActions.updateEnvironments, this.updateEnvironments);
  },

  reset(state) {
    // Has passed the enforcement state
    this._hasEnforcedProject = false;
    this._hasInitialState = false;
    this.state = state || getDefaultSelection();
  },

  isReady() {
    return this._hasInitialState;
  },

  onSetOrganization(organization) {
    this.organization = organization;
  },

  /**
   * Initializes the global selection store data
   */
  onInitializeUrlState(newSelection) {
    this._hasInitialState = true;
    this.state = newSelection;
    this.trigger(this.get());
  },

  get() {
    return {
      selection: this.state,
      isReady: this.isReady(),
    };
  },

  onReset() {
    this.reset();
    this.trigger(this.get());
  },

  updateProjects(projects = [], environments = null) {
    if (isEqual(this.state.projects, projects)) {
      return;
    }

    this.state = {
      ...this.state,
      projects,
      environments: environments === null ? this.state.environments : environments,
    };
    this.trigger(this.get());
  },

  updateDateTime(datetime) {
    if (isEqualWithDates(this.state.datetime, datetime)) {
      return;
    }

    this.state = {
      ...this.state,
      datetime,
    };
    this.trigger(this.get());
  },

  updateEnvironments(environments) {
    if (isEqual(this.state.environments, environments)) {
      return;
    }

    this.state = {
      ...this.state,
      environments: environments ?? [],
    };
    this.trigger(this.get());
  },

  /**
   * Save to local storage when user explicitly changes header values.
   *
   * e.g. if localstorage is empty, user loads issue details for project "foo"
   * this should not consider "foo" as last used and should not save to local storage.
   *
   * However, if user then changes environment, it should...? Currently it will
   * save the current project alongside environment to local storage. It's debatable if
   * this is the desired behavior.
   */
  onSave(updateObj: UpdateData) {
    // Do nothing if no org is loaded or user is not an org member. Only
    // organizations that a user has membership in will be available via the
    // organizations store
    if (!this.organization || !OrganizationsStore.get(this.organization.slug)) {
      return;
    }

    const {project, environment} = updateObj;
    const validatedProject = typeof project === 'string' ? [Number(project)] : project;
    const validatedEnvironment =
      typeof environment === 'string' ? [environment] : environment;

    try {
      const localStorageKey = `${LOCAL_STORAGE_KEY}:${this.organization.slug}`;
      const dataToSave = {
        projects: validatedProject || this.selection.projects,
        environments: validatedEnvironment || this.selection.environments,
      };
      localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
    } catch (ex) {
      // Do nothing
    }
  },
};

export default Reflux.createStore(storeConfig) as GlobalSelectionStore;
