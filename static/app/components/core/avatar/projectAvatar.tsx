import {Tooltip} from 'sentry/components/core/tooltip';
import {PlatformList} from 'sentry/components/platformList';
import type {AvatarProject} from 'sentry/types/project';

import type {BaseAvatarProps} from './baseAvatar';

interface ProjectAvatarProps extends BaseAvatarProps {
  project: AvatarProject;
  direction?: 'left' | 'right';
  ref?: React.Ref<HTMLDivElement>;
}

export function ProjectAvatar({
  ref,
  project,
  hasTooltip,
  tooltip,
  ...props
}: ProjectAvatarProps) {
  return (
    <Tooltip disabled={!hasTooltip} title={tooltip}>
      <PlatformList
        // `platform` is a user selectable option that is performed during the onboarding process. The reason why this
        // is not the default is because there currently is no way to update it. Fallback to this if project does not
        // have recent events with a platform.
        platforms={project?.platform ? [project.platform] : []}
        {...props}
        ref={ref}
        max={1}
      />
    </Tooltip>
  );
}
