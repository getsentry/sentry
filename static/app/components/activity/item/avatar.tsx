import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import Placeholder from 'sentry/components/placeholder';
import {IconSentry} from 'sentry/icons';
import type {AvatarUser} from 'sentry/types/user';

type Props = {
  type: 'system' | 'user';
  className?: string;
  size?: number;
  user?: AvatarUser;
};

export function ActivityAvatar({className, type, user, size = 38}: Props) {
  if (user) {
    return <UserAvatar user={user} size={size} className={className} />;
  }

  if (type === 'system') {
    // Return Sentry avatar
    return (
      <SystemAvatar className={className} size={size}>
        <StyledIconSentry size="md" />
      </SystemAvatar>
    );
  }

  return (
    <Placeholder
      className={className}
      width={`${size}px`}
      height={`${size}px`}
      shape="circle"
    />
  );
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
  color: ${p => p.theme.tokens.background.primary};
  background-color: ${p => p.theme.tokens.content.primary};
  border-radius: 50%;
`;

const StyledIconSentry = styled(IconSentry)`
  padding-bottom: 3px;
`;
