import {Component} from 'react';

import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import PlatformList from 'sentry/components/platformList';
import Tooltip from 'sentry/components/tooltip';
import {AvatarProject} from 'sentry/types';

type Props = {
  project: AvatarProject;
} & BaseAvatar['props'];

class ProjectAvatar extends Component<Props> {
  getPlatforms = (project: AvatarProject) => {
    // `platform` is a user selectable option that is performed during the onboarding process. The reason why this
    // is not the default is because there currently is no way to update it. Fallback to this if project does not
    // have recent events with a platform.
    if (project && project.platform) {
      return [project.platform];
    }

    return [];
  };

  render() {
    const {project, hasTooltip, tooltip, ...props} = this.props;

    return (
      <Tooltip disabled={!hasTooltip} title={tooltip}>
        <PlatformList platforms={this.getPlatforms(project)} {...props} max={1} />
      </Tooltip>
    );
  }
}
export default ProjectAvatar;
