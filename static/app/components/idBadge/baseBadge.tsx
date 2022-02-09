import * as React from 'react';
import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {AvatarProject, Organization, Team} from 'sentry/types';

type Props = {
  displayName: React.ReactNode;
  avatarProps?: Record<string, any>;
  avatarSize?: number;
  className?: string;
  description?: React.ReactNode;
  // Hides the main display name
  hideAvatar?: boolean;
  hideName?: boolean;
  organization?: Organization;
  project?: AvatarProject;
  team?: Team;
};

const BaseBadge = React.memo(
  ({
    displayName,
    hideName = false,
    hideAvatar = false,
    avatarProps = {},
    avatarSize = 24,
    description,
    team,
    organization,
    project,
    className,
  }: Props) => (
    <Wrapper className={className}>
      {!hideAvatar && (
        <StyledAvatar
          {...avatarProps}
          size={avatarSize}
          hideName={hideName}
          team={team}
          organization={organization}
          project={project}
          data-test-id="badge-styled-avatar"
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

export default BaseBadge;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const StyledAvatar = styled(Avatar)<{hideName: boolean}>`
  margin-right: ${p => (p.hideName ? 0 : space(1))};
  flex-shrink: 0;
`;

const DisplayNameAndDescription = styled('div')`
  display: flex;
  flex-direction: column;
  line-height: 1;
  overflow: hidden;
`;

const DisplayName = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
`;

const Description = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray300};
  line-height: 14px;
  ${overflowEllipsis};
`;
