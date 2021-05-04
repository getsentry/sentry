import {Component} from 'react';

import withOrganization from 'app/utils/withOrganization';

import ProjectProguard from './projectProguard';

class ProjectProguardContainer extends Component<ProjectProguard['props']> {
  render() {
    return <ProjectProguard {...this.props} />;
  }
}

export default withOrganization(ProjectProguardContainer);
