import SentryTypes from 'app/proptypes';
import OrganizationState from 'app/mixins/organizationState';

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
