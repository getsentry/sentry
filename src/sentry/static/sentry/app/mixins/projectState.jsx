import SentryTypes from '../proptypes';
import OrganizationState from './organizationState';

let ProjectState = {
  mixins: [OrganizationState],

  contextTypes: {
    project: SentryTypes.Project,
  },

  getProjectFeatures() {
    return new Set(this.context.project.features);
  },

  getProject() {
    return this.context.project;
  },
};

export default ProjectState;
