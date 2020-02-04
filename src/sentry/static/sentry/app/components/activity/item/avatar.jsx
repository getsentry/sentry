import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'app/components/avatar/userAvatar';
import Placeholder from 'app/components/placeholder';
import {IconSentry} from 'app/icons';
import SentryTypes from 'app/sentryTypes';

class ActivityAvatar extends React.Component {
  static propTypes = {
    type: PropTypes.oneOf(['system', 'user']),
    user: SentryTypes.User,
    size: PropTypes.number,
  };

  static defaultProps = {
    size: 38,
  };

  render() {
    const {className, type, user, size} = this.props;
    if (user) {
      return <UserAvatar user={user} size={size} className={className} />;
    }

    if (type === 'system') {
      // Return Sentry avatar
      return (
        <SystemAvatar className={className} size={size}>
          <IconLogo size={`${Math.round(size * 0.8)}px`} />
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
}

export default ActivityAvatar;

const SystemAvatar = styled('span')`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
`;

const IconLogo = styled(IconSentry)`
  color: ${p => p.theme.gray5};
`;
