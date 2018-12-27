import SentryTypes from 'app/sentryTypes';
import ProjectState from 'app/mixins/projectState';

let GroupState = {
  mixins: [ProjectState],

  contextTypes: {
    group: SentryTypes.Group.isRequired,
  },

  getGroup() {
    return this.context.group;
  },
};

export default GroupState;
