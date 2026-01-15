import {memo} from 'react';
import styled from '@emotion/styled';

import {
  OrganizationAvatar,
  ProjectAvatar,
  TeamAvatar,
  UserAvatar,
} from '@sentry/scraps/avatar';
import {ActorAvatar} from '@sentry/scraps/avatar/actorAvatar';
import {Flex} from '@sentry/scraps/layout';

import {space, type ValidSize} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Organization, Team} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';

export interface BaseBadgeProps {
  avatarProps?: Record<string, any>;
  avatarSize?: number;
  className?: string;
  description?: React.ReactNode;
  // Hides the main display name
  hideAvatar?: boolean;
  hideName?: boolean;
  onClick?: React.HTMLAttributes<HTMLDivElement>['onClick'];
}

interface AllBaseBadgeProps extends BaseBadgeProps {
  displayName: React.ReactNode;
  actor?: Actor;
  organization?: Organization;
  project?: AvatarProject;
  team?: Team;
  user?: AvatarUser;
}

export const BaseBadge = memo(
  ({
    displayName,
    hideName = false,
    hideAvatar = false,
    avatarProps = {},
    avatarSize = 24,
    description,
    onClick,
    team,
    user,
    organization,
    project,
    actor,
    className,
  }: AllBaseBadgeProps) => {
    // Space items appropriatley depending on avatar size
    const wrapperGap: ValidSize = avatarSize <= 14 ? 0.5 : avatarSize <= 20 ? 0.75 : 1;

    return (
      <Flex
        align="center"
        flexShrink={0}
        className={className}
        style={{gap: space(wrapperGap)}}
        onClick={onClick}
      >
        {!hideAvatar && (
          <EntityAvatarType
            team={team}
            user={user}
            organization={organization}
            project={project}
            actor={actor}
            avatarProps={{...avatarProps, size: avatarSize}}
          />
        )}

        {(!hideName || !!description) && (
          <DisplayNameAndDescription>
            {!hideName && (
              <DisplayName data-test-id="badge-display-name">{displayName}</DisplayName>
            )}
            {!!description && <Description>{description}</Description>}
          </DisplayNameAndDescription>
        )}
      </Flex>
    );
  }
);

function EntityAvatarType({
  user,
  team,
  organization,
  project,
  actor,
  avatarProps,
}: Pick<
  AllBaseBadgeProps,
  'user' | 'team' | 'organization' | 'project' | 'actor' | 'avatarProps'
>) {
  if (user) {
    return <UserAvatar user={user} {...avatarProps} />;
  }

  if (team) {
    return <TeamAvatar team={team} {...avatarProps} />;
  }

  if (organization) {
    return <OrganizationAvatar organization={organization} {...avatarProps} />;
  }

  if (project) {
    return <ProjectAvatar project={project} {...avatarProps} />;
  }

  if (actor) {
    return <ActorAvatar actor={actor} {...avatarProps} />;
  }

  return null;
}

const DisplayNameAndDescription = styled('div')`
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  overflow: hidden;
`;

const DisplayName = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
`;

const Description = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.tokens.content.secondary};
  line-height: 14px;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
