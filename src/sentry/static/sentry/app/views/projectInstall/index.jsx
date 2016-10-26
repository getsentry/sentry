import React from 'react';

import ProjectContext from '../projects/projectContext';
import ProjectInstallLayout from './projectInstallLayout';

const ProjectInstall = React.createClass({
  render() {
    let {projectId, orgId} = this.props.params;
    return (
      <ProjectContext orgId={orgId} projectId={projectId}>
        <ProjectInstallLayout>
          {this.props.children}
        </ProjectInstallLayout>
      </ProjectContext>
    );
  }
});

export default ProjectInstall;
