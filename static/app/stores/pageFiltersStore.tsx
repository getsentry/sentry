import isEqual from 'lodash/isEqual';
import Reflux from 'reflux';

import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import {LOCAL_STORAGE_KEY} from 'sentry/constants/pageFilters';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {Organization, PageFilters} from 'sentry/types';
import {isEqualWithDates} from 'sentry/utils/isEqualWithDates';
import localStorage from 'sentry/utils/localStorage';

import {CommonStoreInterface} from './types';

type UpdateData = {
  project: number[];
  environment: string[];
};

type State = {
  selection: PageFilters;
  isReady: boolean;
};

type Internals = {
  selection: PageFilters;
  hasInitialState: boolean;
  organization: Organization | null;
};

type PageFiltersStoreInterface = CommonStoreInterface<State> & {
  reset(selection?: PageFilters): void;
  onReset(): void;
  onSetOrganization(organization: Organization): void;
  onInitializeUrlState(newSelection: PageFilters): void;
  updateProjects(projects: PageFilters['projects'], environments: null | string[]): void;
  updateDateTime(datetime: PageFilters['datetime']): void;
  updateEnvironments(environments: string[]): void;
  onSave(data: UpdateData): void;
};

const storeConfig: Reflux.StoreDefinition & Internals & PageFiltersStoreInterface = {
  selection: getDefaultSelection(),
  hasInitialState: false,
  organization: null,

  init() {
    this.reset(this.selection);
    this.listenTo(PageFiltersActions.reset, this.onReset);
    this.listenTo(PageFiltersActions.initializeUrlState, this.onInitializeUrlState);
    this.listenTo(PageFiltersActions.setOrganization, this.onSetOrganization);
    this.listenTo(PageFiltersActions.save, this.onSave);
    this.listenTo(PageFiltersActions.updateProjects, this.updateProjects);
    this.listenTo(PageFiltersActions.updateDateTime, this.updateDateTime);
    this.listenTo(PageFiltersActions.updateEnvironments, this.updateEnvironments);
  },

  reset(selection) {
    this._hasInitialState = false;
    this.selection = selection || getDefaultSelection();
  },

  onSetOrganization(organization) {
    this.organization = organization;
  },

  /**
   * Initializes the page filters store data
   */
  onInitializeUrlState(newSelection) {
    this._hasInitialState = true;
    this.selection = newSelection;
    this.trigger(this.getState());
  },

  getState() {
    const isReady = this._hasInitialState;
    const {selection} = this;

    return {selection, isReady};
  },

  onReset() {
    this.reset();
    this.trigger(this.getState());
  },

  updateProjects(projects = [], environments = null) {
    if (isEqual(this.selection.projects, projects)) {
      return;
    }

    this.selection = {
      ...this.selection,
      projects,
      environments: environments === null ? this.selection.environments : environments,
    };
    this.trigger(this.getState());
  },

  updateDateTime(datetime) {
    if (isEqualWithDates(this.selection.datetime, datetime)) {
      return;
    }

    this.selection = {
      ...this.selection,
      datetime,
    };
    this.trigger(this.getState());
  },

  updateEnvironments(environments) {
    if (isEqual(this.selection.environments, environments)) {
      return;
    }

    this.selection = {
      ...this.selection,
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

const PageFiltersStore = Reflux.createStore(storeConfig) as Reflux.Store &
  PageFiltersStoreInterface;

export default PageFiltersStore;
