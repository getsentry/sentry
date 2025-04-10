import styled from '@emotion/styled';

import UserBadge from 'sentry/components/idBadge/userBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
import {useUser} from 'sentry/utils/useUser';

export type UserCellProps = {
  user: 'sentry' | AvatarUser;
  className?: string;
  disabled?: boolean;
};

export function UserCell({user, disabled = false, className}: UserCellProps) {
  const currentUser = useUser();
  const isCurrentUser = user !== 'sentry' && user && currentUser.id === user.id;
  const suffix = isCurrentUser ? ` (You)` : '';
  return (
    <Wrapper disabled={disabled} className={className}>
      {user === 'sentry' ? (
        <Tooltip title={t('Sentry')}>
          <IconSentry size="lg" />
        </Tooltip>
      ) : (
        <Tooltip title={`${user.name || user.email || user.username}${suffix}`}>
          <UserBadge hideEmail hideName avatarSize={24} user={user} />
        </Tooltip>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;
