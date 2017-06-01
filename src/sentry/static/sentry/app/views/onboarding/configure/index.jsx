import React from 'react';
import {onboardingSteps} from '../utils';
import Waiting from './waiting';
import ProjectInstallPlatform from '../../projectInstall/platform';
import ProjectDocsContext from '../../projectInstall/docsContext';

import ProjectContext from '../../projects/projectContext';
import {platforms} from '../../../../../../integration-docs/_platforms.json';

const Configure = React.createClass({
  propTypes: {
    next: React.PropTypes.func,
    platform: React.PropTypes.string,
    project: React.PropTypes.object
  },

  childContextTypes: {
    project: React.PropTypes.object
  },
  getInitialState() {
    return {};
  },

  getChildContext() {
    return {project: this.props.project};
  },

  steps: Object.keys(onboardingSteps),
  render() {
    return (
      <div className="onboarding-Configure">
        <Waiting />
        <ProjectContext
          projectId={this.props.project.slug}
          orgId={this.props.params.orgId}>
          <ProjectDocsContext />
        </ProjectContext>
        <ProjectInstallPlatform
          platformData={{
            // TODO(maxbittker) don't hardcode these
            dsn: 'https://faf12479a76f479999efe89f2c5378d5:5e9a998edd3441bd8a1d24c63fddbfa2@sentry.io/180233',
            dsnPublic: 'https://faf12479a76f479999efe89f2c5378d5@sentry.io/180233',
            platforms: platforms
          }}
          params={{
            platform: this.props.platform,
            orgId: this.props.params.orgId,
            projectId: this.props.project.slug
          }}
        />

        <div className="btn btn-primary" onClick={this.props.next}>
          next step
        </div>
      </div>
    );
  }
});

export default Configure;
