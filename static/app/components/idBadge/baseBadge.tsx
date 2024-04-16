import {memo} from 'react';
import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import {space} from 'sentry/styles/space';
import type {AvatarProject, AvatarUser, Organization, Team} from 'sentry/types';

export interface BaseBadgeProps {
  avatarProps?: Record<string, any>;
  avatarSize?: number;
  className?: string;
  description?: React.ReactNode;
  // Hides the main display name
  hideAvatar?: boolean;
  hideName?: boolean;
}

interface AllBaseBadgeProps extends BaseBadgeProps {
  displayName: React.ReactNode;
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
    team,
    user,
    organization,
    project,
    className,
  }: AllBaseBadgeProps) => (
    <Wrapper className={className}>
      {!hideAvatar && (
        <Avatar
          {...avatarProps}
          size={avatarSize}
          team={team}
          user={user}
          organization={organization}
          project={project}
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
    </Wrapper>
  )
);

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  flex-shrink: 0;
`;

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
  color: ${p => p.theme.gray300};
  line-height: 14px;
  ${p => p.theme.overflowEllipsis};
`;
