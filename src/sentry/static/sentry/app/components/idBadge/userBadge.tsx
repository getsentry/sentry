import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {AvatarUser, Member} from 'app/types';
import UserAvatar from 'app/components/avatar/userAvatar';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';
import omit from 'lodash/omit';

const defaultProps = {
  useLink: true,
  hideEmail: false,
};

type Props = {
  avatarSize: UserAvatar['props']['size'];
  className?: string;
  displayName?: string;
  displayEmail?: string;
  user?: AvatarUser;
  member?: Member;
  orgId?: string;
} & Partial<typeof defaultProps>;

function getUser(props: {user?: AvatarUser; member?: Member}): AvatarUser | undefined {
  if (props.user) {
    return props.user;
  }
  if (props.member && props.member.user) {
    return props.member.user;
  }
  return undefined;
}

const UserBadge = ({
  className,
  displayName,
  displayEmail,
  orgId,
  avatarSize,
  useLink,
  hideEmail,
  ...props
}: Props) => {
  const user = getUser(props);
  const member = props.member;
  const title =
    displayName ||
    (user &&
      (user.name ||
        user.email ||
        user.username ||
        user.ipAddress ||
        // Because this can be used to render EventUser models, or User *interface*
        // objects from serialized Event models. we try both ipAddress and ip_address.
        user.ip_address)) ||
    (member && member.name);

  return (
    <StyledUserBadge className={className}>
      <StyledAvatar user={user} size={avatarSize} />
      <StyledNameAndEmail>
        <StyledName
          useLink={useLink && orgId && member}
          hideEmail={hideEmail}
          to={member && orgId && `/settings/${orgId}/members/${member.id}/`}
        >
          {title}
        </StyledName>
        {!hideEmail && <StyledEmail>{displayEmail || (user && user.email)}</StyledEmail>}
      </StyledNameAndEmail>
    </StyledUserBadge>
  );
};

UserBadge.propTypes = {
  displayName: PropTypes.node,
  displayEmail: PropTypes.node,
  avatarSize: PropTypes.number,
  /**
   * Sometimes we may not have the member object (i.e. the current user, `ConfigStore.get('user')`,
   * is an user, not a member)
   */
  user: SentryTypes.User,
  /**
   * This is a Sentry member (not the user object that is a child of the member object)
   */
  member: SentryTypes.Member,
  orgId: PropTypes.string,
  useLink: PropTypes.bool,
  hideEmail: PropTypes.bool,
};

UserBadge.defaultProps = defaultProps;

const StyledUserBadge = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledNameAndEmail = styled('div')`
  flex-shrink: 1;
  min-width: 0;
  line-height: 1;
`;

const StyledEmail = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;

type NameProps = {
  useLink: boolean;
  hideEmail: boolean;
} & Link['props'];

const StyledName = styled<NameProps>(({useLink, to, ...props}) => {
  const forwardProps = omit(props, 'hideEmail');
  return useLink ? <Link to={to} {...forwardProps} /> : <span {...forwardProps} />;
})`
  font-weight: ${(p: NameProps) => (p.hideEmail ? 'inherit' : 'bold')};
  line-height: 1.15em;
  ${overflowEllipsis};
`;

const StyledAvatar = styled(UserAvatar)`
  min-width: ${space(3)};
  min-height: ${space(3)};
  margin-right: ${space(1)};
`;

export default UserBadge;
