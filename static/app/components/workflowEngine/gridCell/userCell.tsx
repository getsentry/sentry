import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
import {useUser} from 'sentry/utils/useUser';
import useUserFromId from 'sentry/utils/useUserFromId';

export type UserCellProps = {
  user: 'sentry' | string;
  className?: string;
  disabled?: boolean;
};

export function UserCell({user: id, disabled = false, className}: UserCellProps) {
  const currentUser = useUser();
  const {data} = useUserFromId({id: id === 'sentry' ? 0 : Number.parseInt(id, 10)});
  const user = data as AvatarUser;
  const isCurrentUser = id !== 'sentry' && user && currentUser.id === id;
  const suffix = isCurrentUser ? ` (You)` : '';

  return (
    <Wrapper disabled={disabled} className={className}>
      {id === 'sentry' ? (
        <Tooltip title={t('Sentry')}>
          <IconSentry size="lg" />
        </Tooltip>
      ) : (
        user && (
          <Tooltip title={`${user.name}${suffix}`}>
            <UserBadge hideEmail hideName avatarSize={24} user={user} />
          </Tooltip>
        )
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;
