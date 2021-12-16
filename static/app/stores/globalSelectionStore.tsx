import isEqual from 'lodash/isEqual';
import Reflux from 'reflux';

import GlobalSelectionActions from 'sentry/actions/globalSelectionActions';
import {getDefaultSelection} from 'sentry/components/organizations/globalSelectionHeader/utils';
import {LOCAL_STORAGE_KEY} from 'sentry/constants/pageFilters';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {GlobalSelection, Organization} from 'sentry/types';
import {isEqualWithDates} from 'sentry/utils/isEqualWithDates';
import localStorage from 'sentry/utils/localStorage';

import {CommonStoreInterface} from './types';

type UpdateData = {
  project: number[];
  environment: string[];
};

type State = {
  selection: GlobalSelection;
  isReady: boolean;
};

type GlobalSelectionStoreInterface = CommonStoreInterface<State> & {
  state: GlobalSelection;

  reset(state?: GlobalSelection): void;
  onReset(): void;
  isReady(): boolean;
  onSetOrganization(organization: Organization): void;
  onInitializeUrlState(newSelection: GlobalSelection): void;
  updateProjects(
    projects: GlobalSelection['projects'],
    environments: null | string[]
  ): void;
  updateDateTime(datetime: GlobalSelection['datetime']): void;
  updateEnvironments(environments: string[]): void;
  onSave(data: UpdateData): void;
};

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
    this.trigger(this.getState());
  },

  getState() {
    return {
      selection: this.state,
      isReady: this.isReady(),
    };
  },

  onReset() {
    this.reset();
    this.trigger(this.getState());
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
    this.trigger(this.getState());
  },

  updateDateTime(datetime) {
    if (isEqualWithDates(this.state.datetime, datetime)) {
      return;
    }

    this.state = {
      ...this.state,
      datetime,
    };
    this.trigger(this.getState());
  },

  updateEnvironments(environments) {
    if (isEqual(this.state.environments, environments)) {
      return;
    }

    this.state = {
      ...this.state,
      environments: environments ?? [],
    };
    this.trigger(this.getState());
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

const GlobalSelectionStore = Reflux.createStore(storeConfig) as Reflux.Store &
  GlobalSelectionStoreInterface;

export default GlobalSelectionStore;
