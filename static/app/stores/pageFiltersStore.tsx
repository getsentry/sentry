import {createStore} from 'reflux';

import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import type {PageFilters, PinnedPageFilter} from 'sentry/types';

import type {CommonStoreDefinition} from './types';

function datetimeHasSameValue(
  a: PageFilters['datetime'],
  b: PageFilters['datetime']
): boolean {
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }

  for (const key in a) {
    if (a[key] instanceof Date && b[key] instanceof Date) {
      // This will fail on invalid dates as NaN !== NaN,
      // but thats fine since we don't want invalid dates to be equal
      if (a[key].getTime() === b[key].getTime()) {
        continue;
      }
      return false;
    }

    if (a[key] === null && b[key] === null) {
      continue;
    }

    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

function arrayIsEqual(
  a: string[] | number[] | null,
  b: string[] | number[] | null
): boolean {
  if (a === null && b === null) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    if (a.length === 1 && b.length === 1) {
      return a[0] === b[0];
    }

    return a.every((value, index) => value === b[index]);
  }

  return a === b;
}

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
  /**
   * Whether to save changes to local storage. This setting should be page-specific:
   * most pages should have it on (default) and some, like Dashboard Details, need it
   * off.
   */
  shouldPersist: boolean;
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
  onInitializeUrlState(
    newSelection: PageFilters,
    pinned: Set<PinnedPageFilter>,
    persist?: boolean
  ): void;
  onReset(): void;
  pin(filter: PinnedPageFilter, pin: boolean): void;
  reset(selection?: PageFilters): void;
  updateDateTime(datetime: PageFilters['datetime']): void;
  updateDesyncedFilters(filters: Set<PinnedPageFilter>): void;
  updateEnvironments(environments: string[] | null): void;
  updatePersistence(shouldPersist: boolean): void;
  updateProjects(projects: PageFilters['projects'], environments: null | string[]): void;
}

const storeConfig: PageFiltersStoreDefinition = {
  selection: getDefaultSelection(),
  pinnedFilters: new Set(),
  desyncedFilters: new Set(),
  shouldPersist: true,
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
  onInitializeUrlState(newSelection, pinned, persist = true) {
    this._isReady = true;

    this.selection = newSelection;
    this.pinnedFilters = pinned;
    this.shouldPersist = persist;
    this.trigger(this.getState());
  },

  getState() {
    return {
      selection: this.selection,
      pinnedFilters: this.pinnedFilters,
      desyncedFilters: this.desyncedFilters,
      shouldPersist: this.shouldPersist,
      isReady: this._isReady,
    };
  },

  onReset() {
    this.reset();
    this.trigger(this.getState());
  },

  updatePersistence(shouldPersist: boolean) {
    this.shouldPersist = shouldPersist;
    this.trigger(this.getState());
  },

  updateDesyncedFilters(filters: Set<PinnedPageFilter>) {
    this.desyncedFilters = filters;
    this.trigger(this.getState());
  },

  updateProjects(projects = [], environments = null) {
    if (arrayIsEqual(this.selection.projects, projects)) {
      return;
    }

    if (this.desyncedFilters.has('projects')) {
      const newDesyncedFilters = new Set(this.desyncedFilters);
      newDesyncedFilters.delete('projects');
      this.desyncedFilters = newDesyncedFilters;
    }

    this.selection = {
      ...this.selection,
      projects,
      environments: environments === null ? this.selection.environments : environments,
    };
    this.trigger(this.getState());
  },

  updateDateTime(newDateTime) {
    if (datetimeHasSameValue(this.selection.datetime, newDateTime)) {
      return;
    }

    if (this.desyncedFilters.has('datetime')) {
      const newDesyncedFilters = new Set(this.desyncedFilters);
      newDesyncedFilters.delete('datetime');
      this.desyncedFilters = newDesyncedFilters;
    }

    this.selection = {
      ...this.selection,
      datetime: newDateTime,
    };
    this.trigger(this.getState());
  },

  updateEnvironments(environments) {
    if (arrayIsEqual(this.selection.environments, environments)) {
      return;
    }

    if (this.desyncedFilters.has('environments')) {
      const newDesyncedFilters = new Set(this.desyncedFilters);
      newDesyncedFilters.delete('environments');
      this.desyncedFilters = newDesyncedFilters;
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
