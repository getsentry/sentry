import SentryTypes from 'app/sentryTypes';
import OrganizationState from 'app/mixins/organizationState';

const ProjectState = {
  mixins: [OrganizationState],

  contextTypes: {
    project: SentryTypes.Project,
  },

  getProject() {
    return this.context.project;
  },
};

export default ProjectState;
