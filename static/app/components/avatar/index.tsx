import {forwardRef} from 'react';

import DocIntegrationAvatar from 'sentry/components/avatar/docIntegrationAvatar';
import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import SentryAppAvatar from 'sentry/components/avatar/sentryAppAvatar';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {
  AvatarProject,
  AvatarSentryApp,
  DocIntegration,
  OrganizationSummary,
  Team,
} from 'sentry/types';

type Props = {
  docIntegration?: DocIntegration;
  /**
   * True if the Avatar is full color, rather than B&W (Used for SentryAppAvatar)
   */
  isColor?: boolean;
  /**
   * True if the rendered Avatar should be a static asset
   */
  isDefault?: boolean;
  organization?: OrganizationSummary;
  project?: AvatarProject;
  sentryApp?: AvatarSentryApp;
  team?: Team;
} & React.ComponentProps<typeof UserAvatar>;

const Avatar = forwardRef(function Avatar(
  {
    hasTooltip = false,
    user,
    team,
    project,
    organization,
    sentryApp,
    isColor = true,
    isDefault = false,
    docIntegration,
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
    return (
      <SentryAppAvatar
        sentryApp={sentryApp}
        isColor={isColor}
        isDefault={isDefault}
        {...commonProps}
      />
    );
  }

  if (docIntegration) {
    return <DocIntegrationAvatar docIntegration={docIntegration} {...commonProps} />;
  }

  return <OrganizationAvatar organization={organization} {...commonProps} />;
});

export default Avatar;
