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
          <Logo src="icon-sentry" size={`${Math.round(size * 0.8)}px`} />
        </SystemAvatar>
      );
    }

    return <Placeholder className={className} size={size} />;
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

const Logo = styled(InlineSvg)`
  color: ${p => p.theme.gray5};
`;

const Placeholder = styled('div')`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 100%;
  background-color: #f5f5f5;
  flex-shrink: 0;
`;
