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
    // `platform` is a user selectable option that is performed during the onboarding process. The reason why this
    // is not the default is because there currently is no way to update it. Fallback to this if project does not
    // have recent events with a platform.
    if (project && project.platform) {
      return [project.platform];
    }

    return [];
  };

  render() {
    let {project, ...props} = this.props;

    return <PlatformList platforms={this.getPlatforms(project)} {...props} max={1} />;
  }
}
export default ProjectAvatar;
