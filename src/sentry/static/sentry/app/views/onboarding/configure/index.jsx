import React from 'react';
import {onboardingSteps} from '../utils';
import Waiting from './waiting';

import ProjectContext from '../../projects/projectContext';
import ProjectDocsContext from '../../projectInstall/docsContext';
import ProjectInstallPlatform from '../../projectInstall/platform';

// import {platforms} from '../../../../../../integration-docs/_platforms.json';

const Configure = React.createClass({
  propTypes: {
    next: React.PropTypes.func
  },

  steps: Object.keys(onboardingSteps),
  render() {
    return (
      <div className="onboarding-Configure">
        <Waiting />
        <ProjectContext
          projectId={this.props.params.projectId}
          orgId={this.props.params.orgId}>
          <ProjectDocsContext>
            <ProjectInstallPlatform platformData={{}} params={this.props.params} />
          </ProjectDocsContext>
        </ProjectContext>
        <div className="btn btn-primary" onClick={this.props.next}>
          next step
        </div>
      </div>
    );
  }
});

export default Configure;
