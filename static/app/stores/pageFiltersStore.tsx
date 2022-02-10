import isEqual from 'lodash/isEqual';
import Reflux from 'reflux';

import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import {PageFilters, PinnedPageFilter} from 'sentry/types';
import {isEqualWithDates} from 'sentry/utils/isEqualWithDates';

import {CommonStoreInterface} from './types';

type State = {
  filtersInUrlDifferingFromPinned: Set<PinnedPageFilter>;
  isReady: boolean;
  pinnedFilters: Set<PinnedPageFilter>;
  selection: PageFilters;
};

type Internals = {
  filtersInUrlDifferingFromPinned: Set<PinnedPageFilter>;
  hasInitialState: boolean;
  pinnedFilters: Set<PinnedPageFilter>;
  selection: PageFilters;
};

type PageFiltersStoreInterface = CommonStoreInterface<State> & {
  onInitializeUrlState(
    newSelection: PageFilters,
    pinned: Set<PinnedPageFilter>,
    filtersInUrlDifferingFromPinned: Set<PinnedPageFilter>
  ): void;
  onReset(): void;
  pin(filter: PinnedPageFilter, pin: boolean): void;
  reset(selection?: PageFilters): void;
  updateDateTime(datetime: PageFilters['datetime']): void;
  updateEnvironments(environments: string[]): void;
  updateProjects(projects: PageFilters['projects'], environments: null | string[]): void;
};

const storeConfig: Reflux.StoreDefinition & Internals & PageFiltersStoreInterface = {
  selection: getDefaultSelection(),
  pinnedFilters: new Set(),
  hasInitialState: false,
  filtersInUrlDifferingFromPinned: new Set(),

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
  onInitializeUrlState(newSelection, pinned, filtersInUrlDifferingFromPinned) {
    this._hasInitialState = true;

    this.selection = newSelection;
    this.pinnedFilters = pinned;
    this.filtersInUrlDifferingFromPinned = filtersInUrlDifferingFromPinned;
    this.trigger(this.getState());
  },

  getState() {
    const isReady = this._hasInitialState;
    const {selection, pinnedFilters, filtersInUrlDifferingFromPinned} = this;

    return {selection, pinnedFilters, isReady, filtersInUrlDifferingFromPinned};
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
    this.filtersInUrlDifferingFromPinned.delete('projects');
    if (environments !== null) {
      this.filtersInUrlDifferingFromPinned.delete('environments');
    }

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
    this.filtersInUrlDifferingFromPinned.delete('datetime');

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
    this.filtersInUrlDifferingFromPinned.delete('environments');

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
