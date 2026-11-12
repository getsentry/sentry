import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import type {AvatarUser} from 'sentry/types/user';

import {BadgeDisplayName} from './badgeDisplayName';
import {BaseBadge, type BaseBadgeProps} from './baseBadge';

export interface UserBadgeProps extends BaseBadgeProps {
  displayEmail?: React.ReactNode | string;
  displayName?: React.ReactNode;
  hideEmail?: boolean;
  to?: string;
  user?: AvatarUser;
}

export function UserBadge({
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

  const email = displayEmail || user?.email;
  const name = <Name hideEmail={!!hideEmail}>{title}</Name>;

  return (
    <BaseBadge
      displayName={
        <BadgeDisplayName>
          {to ? <Link to={to}>{name}</Link> : name}
          {!hideEmail && (
            <Container paddingTop="2xs" width="100%">
              {containerProps => (
                <InfoText
                  {...containerProps}
                  as="div"
                  title={email}
                  mode="overflowOnly"
                  size="sm"
                  variant="muted"
                >
                  {email}
                </InfoText>
              )}
            </Container>
          )}
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
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
