import styled from '@emotion/styled';

import UserBadge from 'sentry/components/idBadge/userBadge';
import {IconSentry} from 'sentry/icons';
import type {AvatarUser} from 'sentry/types/user';

export type UserCellProps = {
  user: 'sentry' | AvatarUser;
  className?: string;
  disabled?: boolean;
};

export function UserCell({user, disabled = false, className}: UserCellProps) {
  return (
    <Wrapper disabled={disabled} className={className}>
      {user === 'sentry' ? (
        <IconSentry size="lg" />
      ) : (
        <UserBadge hideEmail hideName avatarSize={24} user={user} />
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;
