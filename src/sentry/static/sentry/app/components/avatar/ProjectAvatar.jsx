import React from 'react';

import BaseAvatar from 'app/components/avatar/baseAvatar';
import PlatformList from 'app/components/platformList';
import SentryTypes from 'app/sentryTypes';

class ProjectAvatar extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    ...BaseAvatar.propTypes,
  };

  render() {
    let {project, ...props} = this.props;

    return <PlatformList platforms={(project && project.platforms) || []} {...props} />;
  }
}
export default ProjectAvatar;
