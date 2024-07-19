import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {AvatarUser} from 'sentry/types/user';

import Link from '../links/link';

import BadgeDisplayName from './badgeDisplayName';
import {BaseBadge, type BaseBadgeProps} from './baseBadge';

export interface UserBadgeProps extends BaseBadgeProps {
  displayEmail?: React.ReactNode | string;
  displayName?: React.ReactNode;
  hideEmail?: boolean;
  to?: string;
  user?: AvatarUser;
}

function UserBadge({
  hideEmail = false,
  displayName,
  displayEmail,
  user,
  to,
  ...props
}: UserBadgeProps) {
  const title =
    displayName ||
    (user &&
      (user.name ||
        user.email ||
        user.username ||
        user.ipAddress ||
        // Because this can be used to render EventUser models, or User *interface*
        // objects from serialized Event models. we try both ipAddress and ip_address.
        user.ip_address ||
        user.ip ||
        user.id));

  const name = <Name hideEmail={!!hideEmail}>{title}</Name>;

  return (
    <BaseBadge
      displayName={
        <BadgeDisplayName>
          {to ? <Link to={to}>{name}</Link> : name}
          {!hideEmail && <Email>{displayEmail || user?.email}</Email>}
        </BadgeDisplayName>
      }
      user={user}
      {...props}
    />
  );
}

const Name = styled('span')<{hideEmail: boolean}>`
  font-weight: ${p => (p.hideEmail ? 'inherit' : 'bold')};
  line-height: 1.15em;
  ${p => p.theme.overflowEllipsis};
`;

const Email = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray300};
  ${p => p.theme.overflowEllipsis};
`;

export default UserBadge;
