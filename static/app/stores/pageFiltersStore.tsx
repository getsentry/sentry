import {createStore} from 'reflux';

import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import type {PageFilters, PinnedPageFilter} from 'sentry/types/core';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';

import type {StrictStoreDefinition} from './types';

function datetimeHasSameValue(
  a: PageFilters['datetime'],
  b: PageFilters['datetime']
): boolean {
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }

  for (const key in a) {
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (a[key] instanceof Date && b[key] instanceof Date) {
      // This will fail on invalid dates as NaN !== NaN,
      // but thats fine since we don't want invalid dates to be equal
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (a[key].getTime() === b[key].getTime()) {
        continue;
      }
      return false;
    }

    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (a[key] === null && b[key] === null) {
      continue;
    }

    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

interface PageFiltersState {
  /**
   * The set of page filters which have been pinned but do not match the current
   * URL state.
   */
  desyncedFilters: Set<PinnedPageFilter>;
  /**
   * Are page filters ready?
   */
  isReady: boolean;
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

interface PageFiltersStoreDefinition extends StrictStoreDefinition<PageFiltersState> {
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
  state: {
    isReady: false,
    selection: getDefaultSelection(),
    pinnedFilters: new Set(),
    desyncedFilters: new Set(),
    shouldPersist: true,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset(this.state.selection);
  },

  reset(selection) {
    this.state = {
      ...this.state,
      isReady: false,
      selection: selection || getDefaultSelection(),
      pinnedFilters: new Set(),
    };
  },

  /**
   * Initializes the page filters store data
   */
  onInitializeUrlState(newSelection, pinned, persist = true) {
    this.state = {
      ...this.state,
      isReady: true,
      selection: newSelection,
      pinnedFilters: pinned,
      shouldPersist: persist,
    };
    this.trigger(this.getState());
  },

  getState() {
    return this.state;
  },

  onReset() {
    this.reset();
    this.trigger(this.getState());
  },

  updatePersistence(shouldPersist: boolean) {
    this.state = {...this.state, shouldPersist};
    this.trigger(this.getState());
  },

  updateDesyncedFilters(filters: Set<PinnedPageFilter>) {
    this.state = {...this.state, desyncedFilters: filters};
    this.trigger(this.getState());
  },

  updateProjects(projects = [], environments = null) {
    if (valueIsEqual(this.state.selection.projects, projects)) {
      return;
    }

    const newDesyncedFilters = new Set(this.state.desyncedFilters);
    if (this.state.desyncedFilters.has('projects')) {
      newDesyncedFilters.delete('projects');
    }

    const selection = {
      ...this.state.selection,
      projects,
      environments:
        environments === null ? this.state.selection.environments : environments,
    };
    this.state = {...this.state, selection, desyncedFilters: newDesyncedFilters};
    this.trigger(this.getState());
  },

  updateDateTime(newDateTime) {
    if (datetimeHasSameValue(this.state.selection.datetime, newDateTime)) {
      return;
    }

    const newDesyncedFilters = new Set(this.state.desyncedFilters);
    if (this.state.desyncedFilters.has('datetime')) {
      newDesyncedFilters.delete('datetime');
    }

    this.state = {
      ...this.state,
      selection: {
        ...this.state.selection,
        datetime: newDateTime,
      },
      desyncedFilters: newDesyncedFilters,
    };
    this.trigger(this.getState());
  },

  updateEnvironments(environments) {
    if (valueIsEqual(this.state.selection.environments, environments)) {
      return;
    }

    const newDesyncedFilters = new Set(this.state.desyncedFilters);
    if (this.state.desyncedFilters.has('environments')) {
      newDesyncedFilters.delete('environments');
    }

    this.state = {
      ...this.state,
      desyncedFilters: newDesyncedFilters,
      selection: {
        ...this.state.selection,
        environments: environments ?? [],
      },
    };

    this.trigger(this.getState());
  },

  pin(filter, pin) {
    const newPinnedFilters = new Set(this.state.pinnedFilters);
    if (pin) {
      newPinnedFilters.add(filter);
    } else {
      newPinnedFilters.delete(filter);
    }

    this.state = {...this.state, pinnedFilters: newPinnedFilters};
    this.trigger(this.getState());
  },
};

const PageFiltersStore = createStore(storeConfig);
export default PageFiltersStore;
