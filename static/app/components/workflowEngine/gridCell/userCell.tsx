import styled from '@emotion/styled';

import UserBadge from 'sentry/components/idBadge/userBadge';
import LogoSentry from 'sentry/components/logoSentry';
import type {AvatarUser} from 'sentry/types/user';
import {useUser} from 'sentry/utils/useUser';

export type UserCellProps = {
  user: 'sentry' | AvatarUser;
  className?: string;
  disabled?: boolean;
};

export function UserCell({user, disabled = false, className}: UserCellProps) {
  const currentUser = useUser();
  const isCurrentUser = user === 'sentry' ? false : currentUser.email === user.email;
  return (
    <Wrapper disabled={disabled} className={className}>
      {user === 'sentry' ? (
        <LogoSentry />
      ) : (
        <UserBadge
          hideEmail
          displayName={`${user.name}${isCurrentUser ? ' (You)' : ''}`}
          user={user}
        />
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;
