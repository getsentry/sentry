import PropTypes from '../proptypes';
import ProjectState from './projectState';

let GroupState = {
  mixins: [ProjectState],

  contextTypes: {
    group: PropTypes.Group.isRequired,
  },

  getGroup() {
    return this.context.group;
  }
};

export default GroupState;

