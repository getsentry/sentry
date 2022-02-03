import isEqual from 'lodash/isEqual';
import Reflux from 'reflux';

import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import {PageFilters, PinnedPageFilter} from 'sentry/types';
import {isEqualWithDates} from 'sentry/utils/isEqualWithDates';

import {CommonStoreInterface} from './types';

type State = {
  selection: PageFilters;
  pinnedFilters: Set<PinnedPageFilter>;
  isReady: boolean;
};

type Internals = {
  selection: PageFilters;
  pinnedFilters: Set<PinnedPageFilter>;
  hasInitialState: boolean;
};

type PageFiltersStoreInterface = CommonStoreInterface<State> & {
  reset(selection?: PageFilters): void;
  onReset(): void;
  onInitializeUrlState(newSelection: PageFilters, pinned: Set<PinnedPageFilter>): void;
  updateProjects(projects: PageFilters['projects'], environments: null | string[]): void;
  updateDateTime(datetime: PageFilters['datetime']): void;
  updateEnvironments(environments: string[]): void;
  pin(filter: PinnedPageFilter, pin: boolean): void;
};

const storeConfig: Reflux.StoreDefinition & Internals & PageFiltersStoreInterface = {
  selection: getDefaultSelection(),
  pinnedFilters: new Set(),
  hasInitialState: false,

  init() {
    this.reset(this.selection);
    this.listenTo(PageFiltersActions.reset, this.onReset);
    this.listenTo(PageFiltersActions.initializeUrlState, this.onInitializeUrlState);
    this.listenTo(PageFiltersActions.updateProjects, this.updateProjects);
    this.listenTo(PageFiltersActions.updateDateTime, this.updateDateTime);
    this.listenTo(PageFiltersActions.updateEnvironments, this.updateEnvironments);
    this.listenTo(PageFiltersActions.pin, this.pin);
  },

  reset(selection) {
    this._hasInitialState = false;
    this.selection = selection || getDefaultSelection();
    this.pinnedFilters = new Set();
  },

  /**
   * Initializes the page filters store data
   */
  onInitializeUrlState(newSelection, pinned) {
    this._hasInitialState = true;

    this.selection = newSelection;
    this.pinnedFilters = pinned;
    this.trigger(this.getState());
  },

  getState() {
    const isReady = this._hasInitialState;
    const {selection, pinnedFilters} = this;

    return {selection, pinnedFilters, isReady};
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

  pin(filter, pin) {
    if (pin) {
      this.pinnedFilters.add(filter);
    } else {
      this.pinnedFilters.delete(filter);
    }

    this.trigger(this.getState());
  },
};

const PageFiltersStore = Reflux.createStore(storeConfig) as Reflux.Store &
  PageFiltersStoreInterface;

export default PageFiltersStore;
