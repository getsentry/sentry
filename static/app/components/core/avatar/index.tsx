import {forwardRef} from 'react';
import * as Sentry from '@sentry/react';

import {
  ActorAvatar,
  type ActorAvatarProps,
} from 'sentry/components/core/avatar/actorAvatar';
import {
  DocIntegrationAvatar,
  type DocIntegrationAvatarProps,
} from 'sentry/components/core/avatar/docIntegrationAvatar';
import {
  OrganizationAvatar,
  type OrganizationAvatarProps,
} from 'sentry/components/core/avatar/organizationAvatar';
import {
  ProjectAvatar,
  type ProjectAvatarProps,
} from 'sentry/components/core/avatar/projectAvatar';
import {
  SentryAppAvatar,
  type SentryAppAvatarProps,
} from 'sentry/components/core/avatar/sentryAppAvatar';
import {TeamAvatar, type TeamAvatarProps} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar, type UserAvatarProps} from 'sentry/components/core/avatar/userAvatar';

type AvatarProps =
  | ActorAvatarProps
  | UserAvatarProps
  | TeamAvatarProps
  | ProjectAvatarProps
  | OrganizationAvatarProps
  | DocIntegrationAvatarProps
  | SentryAppAvatarProps;

const Avatar = forwardRef<HTMLSpanElement | HTMLDivElement, AvatarProps>(
  ({hasTooltip = false, ...props}, ref) => {
    const commonProps = {hasTooltip, ref, ...props};

    if ('actor' in props) {
      return <ActorAvatar actor={props.actor} {...commonProps} />;
    }

    if ('user' in props) {
      return <UserAvatar user={props.user} {...commonProps} />;
    }

    if ('team' in props) {
      return <TeamAvatar team={props.team} {...commonProps} />;
    }

    if ('project' in props) {
      return (
        <ProjectAvatar
          project={props.project}
          {...commonProps}
          ref={ref as React.Ref<HTMLDivElement>}
        />
      );
    }

    if ('sentryApp' in props) {
      return <SentryAppAvatar sentryApp={props.sentryApp} {...commonProps} />;
    }

    if ('docIntegration' in props) {
      return (
        <DocIntegrationAvatar docIntegration={props.docIntegration} {...commonProps} />
      );
    }

    if ('organization' in props) {
      return <OrganizationAvatar organization={props.organization} {...commonProps} />;
    }

    Sentry.captureMessage(
      'Avatar component did not receive any non nullable entity, at least one of actor, user, team, project, organization, docIntegration, or sentryApp is required'
    );

    return null;
  }
);

export default Avatar;
