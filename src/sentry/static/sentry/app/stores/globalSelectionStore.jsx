import {isEqual} from 'lodash';
import Reflux from 'reflux';

import {DATE_TIME} from 'app/components/organizations/globalSelectionHeader/constants';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {isEqualWithDates} from 'app/utils/isEqualWithDates';
import ConfigStore from 'app/stores/configStore';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';

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

const GlobalSelectionStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(GlobalSelectionActions.updateProjects, this.updateProjects);
    this.listenTo(GlobalSelectionActions.updateDateTime, this.updateDateTime);
    this.listenTo(GlobalSelectionActions.updateEnvironments, this.updateEnvironments);
  },

  reset(state) {
    this.selection = state || getDefaultSelection();
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
    this.trigger(this.selection);
  },
});

export default GlobalSelectionStore;
