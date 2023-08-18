import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import PlatformList from 'sentry/components/platformList';
import {Tooltip} from 'sentry/components/tooltip';
import {AvatarProject} from 'sentry/types';

type Props = {
  project: AvatarProject;
  direction?: 'left' | 'right';
} & BaseAvatar['props'];

function ProjectAvatar({project, hasTooltip, tooltip, ...props}: Props) {
  return (
    <Tooltip disabled={!hasTooltip} title={tooltip}>
      <PlatformList
        // `platform` is a user selectable option that is performed during the onboarding process. The reason why this
        // is not the default is because there currently is no way to update it. Fallback to this if project does not
        // have recent events with a platform.
        platforms={project?.platform ? [project.platform] : []}
        {...props}
        max={1}
      />
    </Tooltip>
  );
}

export default ProjectAvatar;
