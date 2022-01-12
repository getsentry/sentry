import isEqual from 'lodash/isEqual';
import Reflux from 'reflux';

import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import {Organization, PageFilters} from 'sentry/types';
import {isEqualWithDates} from 'sentry/utils/isEqualWithDates';

import {CommonStoreInterface} from './types';

type State = {
  selection: PageFilters;
  organization: Organization | null;
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
    const {selection, organization} = this;

    return {selection, isReady, organization};
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
};

const PageFiltersStore = Reflux.createStore(storeConfig) as Reflux.Store &
  PageFiltersStoreInterface;

export default PageFiltersStore;
