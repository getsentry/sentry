import {createStore} from 'zustand/vanilla';

import type {
  DateString,
  PageFilters,
  PinnedPageFilter,
  PageFilterDatetime,
} from 'sentry/types/core';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';

import type {PageFilterAdjustments} from './adjustments';
import {getDefaultPageFilterSelection} from './constants';

function dateHasSameValue(a: DateString, b: DateString): boolean {
  if (a instanceof Date && b instanceof Date) {
    // This will fail on invalid dates as NaN !== NaN,
    // but thats fine since we don't want invalid dates to be equal
    return a.getTime() === b.getTime();
  }
  return a === b;
}

function datetimeHasSameValue(a: PageFilterDatetime, b: PageFilterDatetime): boolean {
  return (
    a.period === b.period &&
    a.utc === b.utc &&
    dateHasSameValue(a.start, b.start) &&
    dateHasSameValue(a.end, b.end)
  );
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
  readonly adjustments: PageFilterAdjustments;
  /**
   * Are page filters ready?
   */
  readonly isReady: boolean;
  /**
   * The set of page filters which are currently pinned
   */
  readonly pinnedFilters: ReadonlySet<PinnedPageFilter>;
  /**
   * The current page filter selection
   */
  readonly selection: PageFilters;
  /**
   * Whether to save changes to local storage. This setting should be page-specific:
   * most pages should have it on (default) and some, like Dashboard Details, need it
   * off.
   */
  readonly shouldPersist: boolean;
}

const initialState: PageFiltersState = {
  isReady: false,
  selection: getDefaultPageFilterSelection(),
  pinnedFilters: new Set(),
  shouldPersist: true,
  adjustments: {},
};

const store = createStore<PageFiltersState>()(() => initialState);

export const PageFiltersStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /**
   * Resets the store but keeps the current selection.
   */
  init(): void {
    PageFiltersStore.reset(store.getState().selection);
  },

  /**
   * Keeps `shouldPersist`, unlike a full reset to the initial state.
   */
  reset(selection?: PageFilters): void {
    store.setState({
      isReady: false,
      selection: selection ?? getDefaultPageFilterSelection(),
      pinnedFilters: new Set(),
      adjustments: {},
    });
  },

  /**
   * Initializes the page filters store data
   */
  onInitializeUrlState(
    newSelection: PageFilters,
    persist = true,
    adjustments: PageFilterAdjustments = {}
  ): void {
    store.setState({
      isReady: true,
      selection: newSelection,
      pinnedFilters: new Set<PinnedPageFilter>(['projects', 'environments', 'datetime']),
      shouldPersist: persist,
      adjustments,
    });
  },

  onReset(): void {
    PageFiltersStore.reset();
  },

  updatePersistence(shouldPersist: boolean): void {
    store.setState({shouldPersist});
  },

  /**
   * Call this *after* the update that caused the adjustment, since updating a
   * filter clears its adjustments.
   */
  addAdjustment<F extends keyof PageFilterAdjustments>(
    filter: F,
    adjustment: NonNullable<PageFilterAdjustments[F]>
  ): void {
    const {adjustments} = store.getState();
    if (valueIsEqual(adjustments[filter], adjustment, true)) {
      return;
    }

    store.setState({adjustments: {...adjustments, [filter]: adjustment}});
  },

  updateProjects(projects: PageFilters['projects'], environments: null | string[]): void {
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

  updateDateTime(newDateTime: PageFilterDatetime): void {
    const state = store.getState();
    if (datetimeHasSameValue(state.selection.datetime, newDateTime)) {
      return;
    }

    store.setState({
      selection: {...state.selection, datetime: newDateTime},
      adjustments: clearAdjustments(state.adjustments, ['datetime']),
    });
  },

  updateEnvironments(environments: string[] | null): void {
    const state = store.getState();
    if (valueIsEqual(state.selection.environments, environments)) {
      return;
    }

    store.setState({
      selection: {...state.selection, environments: environments ?? []},
      adjustments: clearAdjustments(state.adjustments, ['environments']),
    });
  },

  pin(filter: PinnedPageFilter, pin: boolean): void {
    const pinnedFilters = new Set(store.getState().pinnedFilters);
    if (pin) {
      pinnedFilters.add(filter);
    } else {
      pinnedFilters.delete(filter);
    }

    store.setState({pinnedFilters});
  },
};
