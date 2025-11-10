import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Placeholder} from 'sentry/components/placeholder';
import {IconSentry} from 'sentry/icons';
import type {AvatarUser} from 'sentry/types/user';

type Props = {
  type: 'system' | 'user';
  size?: number;
  user?: AvatarUser;
};

export function ActivityAvatar({type, user, size = 38}: Props) {
  if (user) {
    return <UserAvatar user={user} size={size} />;
  }

  if (type === 'system') {
    // Return Sentry avatar
    return (
      <SystemAvatar size={size}>
        <StyledIconSentry size="md" />
      </SystemAvatar>
    );
  }

  return <Placeholder width={`${size}px`} height={`${size}px`} shape="circle" />;
}

type SystemAvatarProps = {
  size: number;
};

const SystemAvatar = styled('span')<SystemAvatarProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  background-color: ${p => p.theme.textColor};
  color: ${p => p.theme.background};
  border-radius: 50%;
`;

const StyledIconSentry = styled(IconSentry)`
  padding-bottom: 3px;
`;
