import isEqual from 'lodash/isEqual';
import Reflux from 'reflux';

import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import {PageFilters, PinnedPageFilter} from 'sentry/types';
import {isEqualWithDates} from 'sentry/utils/isEqualWithDates';

import {CommonStoreInterface} from './types';

type State = {
  desyncedFilters: Set<PinnedPageFilter>;
  isReady: boolean;
  pinnedFilters: Set<PinnedPageFilter>;
  selection: PageFilters;
};

type Internals = {
  /**
   * The set of page filters which have been pinned but do not match the current
   * URL state.
   */
  desyncedFilters: Set<PinnedPageFilter>;
  /**
   * Have we initalized page filters?
   */
  hasInitialState: boolean;
  /**
   * The set of page filters which are currently pinned
   */
  pinnedFilters: Set<PinnedPageFilter>;
  /**
   * The current page filter selection
   */
  selection: PageFilters;
};

type PageFiltersStoreInterface = CommonStoreInterface<State> & {
  onInitializeUrlState(newSelection: PageFilters, pinned: Set<PinnedPageFilter>): void;
  onReset(): void;
  pin(filter: PinnedPageFilter, pin: boolean): void;
  reset(selection?: PageFilters): void;
  updateDateTime(datetime: PageFilters['datetime']): void;
  updateDesyncedFilters(filters: Set<PinnedPageFilter>): void;
  updateEnvironments(environments: string[]): void;
  updateProjects(projects: PageFilters['projects'], environments: null | string[]): void;
};

const storeConfig: Reflux.StoreDefinition & Internals & PageFiltersStoreInterface = {
  selection: getDefaultSelection(),
  pinnedFilters: new Set(),
  desyncedFilters: new Set(),
  hasInitialState: false,

  init() {
    this.reset(this.selection);
    this.listenTo(PageFiltersActions.reset, this.onReset);
    this.listenTo(PageFiltersActions.initializeUrlState, this.onInitializeUrlState);
    this.listenTo(PageFiltersActions.updateProjects, this.updateProjects);
    this.listenTo(PageFiltersActions.updateDateTime, this.updateDateTime);
    this.listenTo(PageFiltersActions.updateEnvironments, this.updateEnvironments);
    this.listenTo(PageFiltersActions.updateDesyncedFilters, this.updateDesyncedFilters);
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
    const {selection, pinnedFilters, desyncedFilters} = this;

    return {selection, pinnedFilters, desyncedFilters, isReady};
  },

  onReset() {
    this.reset();
    this.trigger(this.getState());
  },

  updateDesyncedFilters(filters: Set<PinnedPageFilter>) {
    this.desyncedFilters = filters;
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
