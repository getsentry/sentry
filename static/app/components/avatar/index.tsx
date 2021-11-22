import * as React from 'react';

import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import ProjectAvatar from 'app/components/avatar/projectAvatar';
import SentryAppAvatar from 'app/components/avatar/sentryAppAvatar';
import TeamAvatar from 'app/components/avatar/teamAvatar';
import UserAvatar from 'app/components/avatar/userAvatar';
import {AvatarProject, OrganizationSummary, SentryApp, Team} from 'app/types';

type Props = {
  team?: Team;
  organization?: OrganizationSummary;
  project?: AvatarProject;
  sentryApp?: SentryApp;
  /**
   * True if the Avatar is full color, rather than B&W (Used for SentryAppAvatar)
   */
  isColor?: boolean;
} & UserAvatar['props'];

const Avatar = React.forwardRef(function Avatar(
  {
    hasTooltip = false,
    user,
    team,
    project,
    organization,
    sentryApp,
    isColor = true,
    ...props
  }: Props,
  ref: React.Ref<HTMLSpanElement>
) {
  const commonProps = {hasTooltip, forwardedRef: ref, ...props};

  if (user) {
    return <UserAvatar user={user} {...commonProps} />;
  }

  if (team) {
    return <TeamAvatar team={team} {...commonProps} />;
  }

  if (project) {
    return <ProjectAvatar project={project} {...commonProps} />;
  }

  if (sentryApp) {
    return <SentryAppAvatar sentryApp={sentryApp} isColor={isColor} {...commonProps} />;
  }

  return <OrganizationAvatar organization={organization} {...commonProps} />;
});

export default Avatar;
