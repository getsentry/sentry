import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import UserAvatar from 'app/components/avatar/userAvatar';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';
import omit from 'lodash/omit';

const UserBadge = ({
  displayName,
  displayEmail,
  user,
  member,
  orgId,
  avatarSize,
  useLink,
  hideEmail,
  ...props
}) => {
  const userFromPropsOrMember = user || (member && member.user) || member;
  return (
    <StyledUserBadge {...props}>
      <StyledAvatar user={userFromPropsOrMember} size={avatarSize} />
      <StyledNameAndEmail>
        <StyledName
          useLink={useLink && orgId && member}
          hideEmail={hideEmail}
          to={member && orgId && `/settings/${orgId}/members/${member.id}/`}
        >
          {displayName ||
            userFromPropsOrMember.name ||
            userFromPropsOrMember.email ||
            userFromPropsOrMember.username ||
            userFromPropsOrMember.ipAddress ||
            /**
             * Because this can be used to render EventUser models, or User *interface*
             * objects from serialized Event models. we try both ipAddress and ip_address.
             */
            userFromPropsOrMember.ip_address}
        </StyledName>
        {!hideEmail && (
          <StyledEmail>{displayEmail || userFromPropsOrMember.email}</StyledEmail>
        )}
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

UserBadge.defaultProps = {
  useLink: true,
  hideEmail: false,
};

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

const StyledName = styled(({useLink, to, ...props}) => {
  const forwardProps = omit(props, 'hideEmail');
  return useLink ? <Link to={to} {...forwardProps} /> : <span {...forwardProps} />;
})`
  font-weight: ${p => (p.hideEmail ? 'inherit' : 'bold')};
  line-height: 1.15em;
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <UserAvatar {...props} />)`
  min-width: ${space(3)};
  min-height: ${space(3)};
  margin-right: ${space(1)};
`;

export default UserBadge;
