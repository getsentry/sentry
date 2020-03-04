import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import Reflux from 'reflux';

import {
  DATE_TIME,
  URL_PARAM,
  LOCAL_STORAGE_KEY,
} from 'app/constants/globalSelectionHeader';
import {getStateFromQuery} from 'app/components/organizations/globalSelectionHeader/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {isEqualWithDates} from 'app/utils/isEqualWithDates';
import OrganizationsStore from 'app/stores/organizationsStore';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';
import localStorage from 'app/utils/localStorage';

const DEFAULT_PARAMS = getParams({});

const getDefaultSelection = () => ({
  projects: [],
  environments: [],
  datetime: {
    [DATE_TIME.START]: DEFAULT_PARAMS.start || null,
    [DATE_TIME.END]: DEFAULT_PARAMS.end || null,
    [DATE_TIME.PERIOD]: DEFAULT_PARAMS.statsPeriod || null,
    [DATE_TIME.UTC]: DEFAULT_PARAMS.utc || null,
  },
});

const getProjectsByIds = async (organization, projectIds, api) => {
  const query = {};
  query.query = projectIds.map(id => `id:${id}`).join(' ');
  return await api.requestPromise(`/organizations/${organization.slug}/projects/`, {
    query,
  });
};

const isValidSelection = async (selection, organization, api) => {
  if (organization.projects) {
    const allowedProjects = new Set(
      organization.projects
        .filter(project => project.hasAccess)
        .map(p => parseInt(p.id, 10))
    );
    if (
      Array.isArray(selection.projects) &&
      selection.projects.some(project => !allowedProjects.has(project))
    ) {
      return false;
    }
    return true;
  } else {
    // if the selection is [-1] (all projects) or [] (my projects) return true
    if (selection.projects.length === 0 || selection.projects[0] === -1) {
      return true;
    }
    // if we do not have organization.projects then make an API call to fetch projects based on id
    const projects = await getProjectsByIds(organization, selection.projects, api);
    if (
      selection.projects.length !== projects.length ||
      projects.some(project => !project.hasAccess)
    ) {
      return false;
    }
    return true;
  }
};

const GlobalSelectionStore = Reflux.createStore({
  init() {
    this.reset(this.selection);
    this.listenTo(GlobalSelectionActions.reset, this.onReset);
    this.listenTo(GlobalSelectionActions.updateProjects, this.updateProjects);
    this.listenTo(GlobalSelectionActions.updateDateTime, this.updateDateTime);
    this.listenTo(GlobalSelectionActions.updateEnvironments, this.updateEnvironments);
  },

  reset(state) {
    this._hasLoaded = false;
    this.selection = state || getDefaultSelection();
  },

  /**
   * Initializes the global selection store
   * If there are query params apply these, otherwise check local storage
   */
  loadInitialData(
    organization,
    queryParams,
    {api, forceUrlSync, onlyIfNeverLoaded} = {}
  ) {
    // If this option is true, only load if it has never been loaded before
    if (onlyIfNeverLoaded && this._hasLoaded) {
      return;
    }

    this._hasLoaded = true;
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
          [DATE_TIME.UTC]: parsed.utc || null,
        },
      };
    } else {
      try {
        const localStorageKey = `${LOCAL_STORAGE_KEY}:${organization.slug}`;

        const storedValue = localStorage.getItem(localStorageKey);

        const defaultDateTime = getDefaultSelection().datetime;

        if (storedValue) {
          globalSelection = {datetime: defaultDateTime, ...JSON.parse(storedValue)};
        }
      } catch (ex) {
        console.error(ex); // eslint-disable-line no-console
        // use default if invalid
      }
    }
    this.loadSelectionIfValid(globalSelection, organization, forceUrlSync, api);
  },

  async loadSelectionIfValid(globalSelection, organization, forceUrlSync, api) {
    if (await isValidSelection(globalSelection, organization, api)) {
      this.selection = {
        ...globalSelection,
        ...(forceUrlSync ? {forceUrlSync: true} : {}),
      };
      this.trigger(this.selection);
    }
  },

  get() {
    return this.selection;
  },

  onReset() {
    this.reset();
    this.trigger(this.selection);
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
      datetime,
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
    // Do nothing if no org is loaded or user is not an org member. Only
    // organizations that a user has membership in will be available via the
    // organizations store
    if (!this.organization || !OrganizationsStore.get(this.organization.slug)) {
      return;
    }

    try {
      const localStorageKey = `${LOCAL_STORAGE_KEY}:${this.organization.slug}`;
      const dataToSave = {
        projects: this.selection.projects,
        environments: this.selection.environments,
      };
      localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
    } catch (ex) {
      // Do nothing
    }
  },
});

export default GlobalSelectionStore;
