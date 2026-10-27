import {createStore} from 'zustand';

import type {PageFilterAdjustments} from 'sentry/components/pageFilters/adjustments';
import {getDefaultPageFilterSelection} from 'sentry/components/pageFilters/constants';
import type {PageFilters, PinnedPageFilter, PageFilterDatetime} from 'sentry/types/core';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';

function datetimeHasSameValue(a: PageFilterDatetime, b: PageFilterDatetime): boolean {
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }

  for (const key in a) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (a[key] instanceof Date && b[key] instanceof Date) {
      // This will fail on invalid dates as NaN !== NaN,
      // but thats fine since we don't want invalid dates to be equal
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (a[key].getTime() === b[key].getTime()) {
        continue;
      }
      return false;
    }

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (a[key] === null && b[key] === null) {
      continue;
    }

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Drops adjustments for filters the user has since changed themselves.
 */
function clearAdjustments(
  adjustments: PageFilterAdjustments,
  filters: Array<keyof PageFilterAdjustments>
): PageFilterAdjustments {
  if (!filters.some(filter => adjustments[filter])) {
    return adjustments;
  }

  const cleared = {...adjustments};
  for (const filter of filters) {
    delete cleared[filter];
  }

  return cleared;
}

interface PageFiltersState {
  /**
   * Adjustments made to the requested selection during initialization, so pages
   * can explain why the selection isn't what the user asked for.
   */
  adjustments: PageFilterAdjustments;
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

const store = createStore<PageFiltersState>()(() => ({
  isReady: false,
  selection: getDefaultPageFilterSelection(),
  pinnedFilters: new Set(),
  shouldPersist: true,
  adjustments: {},
}));

function getResetState(selection?: PageFilters): PageFiltersState {
  return {
    ...store.getState(),
    isReady: false,
    selection: selection || getDefaultPageFilterSelection(),
    pinnedFilters: new Set(),
    adjustments: {},
  };
}

export const PageFiltersStore = {
  ...store,

  init() {
    PageFiltersStore.reset(store.getState().selection);
  },

  reset(selection?: PageFilters) {
    store.setState(getResetState(selection), true);
  },

  /**
   * Initializes the page filters store data
   */
  onInitializeUrlState(
    newSelection: PageFilters,
    persist = true,
    adjustments: PageFilterAdjustments = {}
  ) {
    store.setState({
      isReady: true,
      selection: newSelection,
      pinnedFilters: new Set<PinnedPageFilter>(['projects', 'environments', 'datetime']),
      shouldPersist: persist,
      adjustments,
    });
  },

  onReset() {
    PageFiltersStore.reset();
  },

  updatePersistence(shouldPersist: boolean) {
    store.setState({shouldPersist});
  },

  /**
   * Call this *after* the update that caused the adjustment, since updating a
   * filter clears its adjustments.
   */
  addAdjustment<F extends keyof PageFilterAdjustments>(
    filter: F,
    adjustment: NonNullable<PageFilterAdjustments[F]>
  ) {
    const {adjustments} = store.getState();
    if (valueIsEqual(adjustments[filter], adjustment, true)) {
      return;
    }

    store.setState({adjustments: {...adjustments, [filter]: adjustment}});
  },

  updateProjects(
    projects: PageFilters['projects'] = [],
    environments: null | string[] = null
  ) {
    const state = store.getState();
    if (valueIsEqual(state.selection.projects, projects)) {
      return;
    }

    store.setState({
      selection: {
        ...state.selection,
        projects,
        environments: environments === null ? state.selection.environments : environments,
      },
      adjustments: clearAdjustments(
        state.adjustments,
        environments === null ? ['projects'] : ['projects', 'environments']
      ),
    });
  },

  updateDateTime(newDateTime: PageFilterDatetime) {
    const state = store.getState();
    if (datetimeHasSameValue(state.selection.datetime, newDateTime)) {
      return;
    }

    store.setState({
      selection: {...state.selection, datetime: newDateTime},
      adjustments: clearAdjustments(state.adjustments, ['datetime']),
    });
  },

  updateEnvironments(environments: string[] | null) {
    const state = store.getState();
    if (valueIsEqual(state.selection.environments, environments)) {
      return;
    }

    store.setState({
      selection: {...state.selection, environments: environments ?? []},
      adjustments: clearAdjustments(state.adjustments, ['environments']),
    });
  },

  pin(filter: PinnedPageFilter, pin: boolean) {
    const newPinnedFilters = new Set(store.getState().pinnedFilters);
    if (pin) {
      newPinnedFilters.add(filter);
    } else {
      newPinnedFilters.delete(filter);
    }

    store.setState({pinnedFilters: newPinnedFilters});
  },
};
