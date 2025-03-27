import type {BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import {PlatformList} from 'sentry/components/platformList';
import {Tooltip} from 'sentry/components/tooltip';
import type {AvatarProject} from 'sentry/types/project';

export interface ProjectAvatarProps extends BaseAvatarProps {
  project: AvatarProject;
  direction?: 'left' | 'right';
}

export function ProjectAvatar({
  ref,
  project,
  hasTooltip,
  tooltip,
  ...props
}: ProjectAvatarProps & {
  ref?: React.Ref<HTMLDivElement>;
}) {
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
