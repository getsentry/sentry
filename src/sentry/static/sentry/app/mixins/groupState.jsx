import SentryTypes from '../proptypes';
import ProjectState from './projectState';

let GroupState = {
  mixins: [ProjectState],

  contextTypes: {
    group: SentryTypes.Group.isRequired
  },

  getGroup() {
    return this.context.group;
  }
};

export default GroupState;
