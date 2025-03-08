import {forwardRef} from 'react';

import {DocIntegrationAvatar} from 'sentry/components/core/avatar/docIntegrationAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import type {Actor} from 'sentry/types/core';
import type {AvatarSentryApp, DocIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary, Team} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar, type UserAvatarProps} from 'sentry/components/core/avatar/userAvatar';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';

export interface AvatarProps extends UserAvatarProps {
  actor?: Actor;
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
}

const Avatar = forwardRef<HTMLSpanElement | HTMLDivElement, AvatarProps>(
  (
    {
      hasTooltip = false,
      actor,
      user,
      team,
      project,
      organization,
      sentryApp,
      isColor = true,
      isDefault = false,
      docIntegration,
      ...props
    },
    ref
  ) => {
    const commonProps = {hasTooltip, ref, ...props};

    if (actor) {
      return <ActorAvatar actor={actor} {...commonProps} />;
    }

    if (user) {
      return <UserAvatar user={user} {...commonProps} />;
    }

    if (team) {
      return <TeamAvatar team={team} {...commonProps} />;
    }

    if (project) {
      return (
        <ProjectAvatar
          project={project}
          {...commonProps}
          ref={ref as React.Ref<HTMLDivElement>}
        />
      );
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
  }
);

export default Avatar;
