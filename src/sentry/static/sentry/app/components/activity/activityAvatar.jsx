import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Avatar from 'app/components/avatar';
import InlineSvg from 'app/components/inlineSvg';
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
      return <Avatar user={user} size={size} className={className} />;
    }

    if (type === 'system') {
      // Return Sentry avatar
      return (
        <SystemAvatar className={className} size={size}>
          <Logo src="icon-sentry" size={Math.round(size * 0.7)} />
        </SystemAvatar>
      );
    }

    return null;
  }
}

export default ActivityAvatar;

const SystemAvatar = styled('span')`
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 100%;
  background-color: ${p => p.theme.purple};
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  vertical-align: middle;
  position: relative;
`;

const Logo = styled(InlineSvg)`
  color: #fff;
`;
