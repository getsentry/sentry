import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {AvatarUser} from 'app/types';
import UserAvatar from 'app/components/avatar/userAvatar';
import InlineSvg from 'app/components/inlineSvg';
import Placeholder from 'app/components/placeholder';
import SentryTypes from 'app/sentryTypes';

type Props = {
  type: 'system' | 'user';
  user?: AvatarUser;
  className?: string;
  size?: number;
};

function ActivityAvatar({className, type, user, size = 38}: Props) {
  if (user) {
    return <UserAvatar user={user} size={size} className={className} />;
  }

  if (type === 'system') {
    // Return Sentry avatar
    return (
      <SystemAvatar className={className} size={size}>
        <Logo src="icon-sentry" size={`${Math.round(size * 0.8)}px`} />
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

ActivityAvatar.propTypes = {
  user: SentryTypes.User,
  type: PropTypes.oneOf(['system', 'user']),
  size: PropTypes.number,
};

export default ActivityAvatar;

type SystemAvatarProps = {
  size: number;
};

const SystemAvatar = styled('span')<SystemAvatarProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
`;

const Logo = styled(InlineSvg)`
  color: ${p => p.theme.gray5};
`;
