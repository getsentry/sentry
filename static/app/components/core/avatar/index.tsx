import {forwardRef} from 'react';
import * as Sentry from '@sentry/react';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar, type UserAvatarProps} from 'sentry/components/core/avatar/userAvatar';
import type {Actor} from 'sentry/types/core';
import type {SentryApp} from 'sentry/types/integrations';
import type {OrganizationSummary, Team} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';

export interface AvatarProps extends UserAvatarProps {
  actor?: Actor;
  organization?: OrganizationSummary;
  project?: AvatarProject;
  sentryApp?: SentryApp;
  team?: Team;
}

const Avatar = forwardRef<HTMLSpanElement | HTMLDivElement, AvatarProps>(
  (
    {hasTooltip = false, actor, user, team, project, organization, sentryApp, ...props},
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
      return <SentryAppAvatar sentryApp={sentryApp} {...commonProps} />;
    }

    if (organization) {
      return <OrganizationAvatar organization={organization} {...commonProps} />;
    }

    Sentry.captureMessage(
      'Avatar component did not receive any non nullable entity, at least one of actor, user, team, project, or organization is required'
    );
    return null;
  }
);

export default Avatar;
