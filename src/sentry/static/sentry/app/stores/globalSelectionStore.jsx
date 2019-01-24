import {isEqual, pick} from 'lodash';
import Reflux from 'reflux';

import {
  DATE_TIME,
  URL_PARAM,
  LOCAL_STORAGE_KEY,
} from 'app/components/organizations/globalSelectionHeader/constants';
import {getStateFromQuery} from 'app/components/organizations/globalSelectionHeader/utils';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {isEqualWithDates} from 'app/utils/isEqualWithDates';
import ConfigStore from 'app/stores/configStore';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';
import localStorage from 'app/utils/localStorage';

const getDefaultSelection = () => {
  const user = ConfigStore.get('user');

  return {
    projects: [],
    environments: [],
    datetime: {
      [DATE_TIME.START]: null,
      [DATE_TIME.END]: null,
      [DATE_TIME.PERIOD]: DEFAULT_STATS_PERIOD,
      [DATE_TIME.UTC]: user?.options?.timezone === 'UTC' ? true : undefined,
    },
  };
};

const isValidSelection = (selection, organization) => {
  const allowedProjects = new Set(
    organization.projects.filter(project => project.isMember).map(p => parseInt(p.id, 10))
  );
  if (
    Array.isArray(selection.projects) &&
    selection.projects.some(project => !allowedProjects.has(project))
  ) {
    return false;
  }

  return true;
};

const GlobalSelectionStore = Reflux.createStore({
  init() {
    this.reset(this.selection);
    this.listenTo(GlobalSelectionActions.updateProjects, this.updateProjects);
    this.listenTo(GlobalSelectionActions.updateDateTime, this.updateDateTime);
    this.listenTo(GlobalSelectionActions.updateEnvironments, this.updateEnvironments);
  },

  reset(state) {
    this.selection = state || getDefaultSelection();
  },

  /**
   * Initializes the global selection store
   * If there are query params apply these, otherwise check local storage
  */
  loadInitialData(organization, queryParams) {
    this.organization = organization;
    const query = pick(queryParams, Object.values(URL_PARAM));
    const hasQuery = Object.keys(query).length > 0;

    let globalSelection = getDefaultSelection();

    if (hasQuery) {
      const parsed = getStateFromQuery(queryParams);
      globalSelection = {
        projects: parsed.project || [],
        environments: parsed.environment || [],
        datetime: {
          [DATE_TIME.START]: parsed.start || null,
          [DATE_TIME.END]: parsed.end || null,
          [DATE_TIME.PERIOD]: parsed.period || null,
          [DATE_TIME.UTC]: parsed.utc || undefined,
        },
      };
    } else {
      try {
        const localStorageKey = `${LOCAL_STORAGE_KEY}:${organization.slug}`;
        const storedValue = JSON.parse(localStorage.getItem(localStorageKey));
        if (storedValue) {
          globalSelection = storedValue;
        }
      } catch (ex) {
        // use default if invalid
      }
    }

    if (isValidSelection(globalSelection, organization)) {
      this.selection = globalSelection;
      this.trigger(this.selection);
    }
  },

  get() {
    return this.selection;
  },

  updateProjects(projects = []) {
    if (isEqual(this.selection.projects, projects)) {
      return;
    }

    this.selection = {
      ...this.selection,
      projects,
    };
    this.updateLocalStorage();
    this.trigger(this.selection);
  },

  updateDateTime(datetime) {
    if (isEqualWithDates(this.selection.datetime, datetime)) {
      return;
    }

    this.selection = {
      ...this.selection,
      datetime: {
        ...this.selection.datetime,
        ...datetime,
      },
    };
    this.updateLocalStorage();
    this.trigger(this.selection);
  },

  updateEnvironments(environments = []) {
    if (isEqual(this.selection.environments, environments)) {
      return;
    }

    this.selection = {
      ...this.selection,
      environments,
    };
    this.updateLocalStorage();
    this.trigger(this.selection);
  },

  updateLocalStorage() {
    try {
      if (!this.organization) {
        throw new Error('No organization loaded');
      }
      const localStorageKey = `${LOCAL_STORAGE_KEY}:${this.organization.slug}`;
      localStorage.setItem(localStorageKey, JSON.stringify(this.selection));
    } catch (ex) {
      // Do nothing
    }
  },
});

export default GlobalSelectionStore;
