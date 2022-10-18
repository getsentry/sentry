import isEqual from 'lodash/isEqual';
import {createStore} from 'reflux';

import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import {PageFilters, PinnedPageFilter} from 'sentry/types';
import {isEqualWithDates} from 'sentry/utils/isEqualWithDates';

import {CommonStoreDefinition} from './types';

interface CommonState {
  /**
   * The set of page filters which have been pinned but do not match the current
   * URL state.
   */
  desyncedFilters: Set<PinnedPageFilter>;
  /**
   * The set of page filters which are currently pinned
   */
  pinnedFilters: Set<PinnedPageFilter>;
  /**
   * The current page filter selection
   */
  selection: PageFilters;
}

/**
 * External state
 */
interface State extends CommonState {
  /**
   * Are page filters ready?
   */
  isReady: boolean;
}

interface InternalDefinition extends CommonState {
  /**
   * Have we initalized page filters?
   */
  hasInitialState: boolean;
}

interface PageFiltersStoreDefinition
  extends InternalDefinition,
    CommonStoreDefinition<State> {
  init(): void;
  onInitializeUrlState(newSelection: PageFilters, pinned: Set<PinnedPageFilter>): void;
  onReset(): void;
  pin(filter: PinnedPageFilter, pin: boolean): void;
  reset(selection?: PageFilters): void;
  updateDateTime(datetime: PageFilters['datetime']): void;
  updateDesyncedFilters(filters: Set<PinnedPageFilter>): void;
  updateEnvironments(environments: string[] | null): void;
  updateProjects(projects: PageFilters['projects'], environments: null | string[]): void;
}

const storeConfig: PageFiltersStoreDefinition = {
  selection: getDefaultSelection(),
  pinnedFilters: new Set(),
  desyncedFilters: new Set(),
  hasInitialState: false,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset(this.selection);
  },

  reset(selection) {
    this._isReady = false;
    this.selection = selection || getDefaultSelection();
    this.pinnedFilters = new Set();
  },

  /**
   * Initializes the page filters store data
   */
  onInitializeUrlState(newSelection, pinned) {
    this._isReady = true;

    this.selection = newSelection;
    this.pinnedFilters = pinned;
    this.trigger(this.getState());
  },

  getState() {
    return {
      selection: this.selection,
      pinnedFilters: this.pinnedFilters,
      desyncedFilters: this.desyncedFilters,
      isReady: this._isReady,
    };
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

const PageFiltersStore = createStore(storeConfig);
export default PageFiltersStore;
