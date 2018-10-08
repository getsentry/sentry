import React from 'react';

import BaseAvatar from 'app/components/avatar/baseAvatar';
import PlatformList from 'app/components/platformList';
import SentryTypes from 'app/sentryTypes';

class ProjectAvatar extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    ...BaseAvatar.propTypes,
  };

  getPlatforms = project => {
    if (project && project.platforms && project.platforms.length > 0) {
      return project.platforms;
    }

    if (project && project.platform) {
      return [project.platform];
    }

    return [];
  };

  render() {
    let {project, ...props} = this.props;

    return <PlatformList platforms={this.getPlatforms(project)} {...props} />;
  }
}
export default ProjectAvatar;
