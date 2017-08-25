import CustomPropTypes from '../proptypes';
import ProjectState from './projectState';

let GroupState = {
  mixins: [ProjectState],

  contextTypes: {
    group: CustomPropTypes.Group.isRequired
  },

  getGroup() {
    return this.context.group;
  }
};

export default GroupState;
