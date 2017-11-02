import PropTypes from 'prop-types';
import React from 'react';
import LetterAvatar from './letterAvatar';

class UserLetterAvatar extends React.Component {
  static propTypes = {
    user: PropTypes.object.isRequired,
  };

  getIdentifier = () => {
    let user = this.props.user;
    return user.email || user.username || user.id || user.ip_address;
  };

  getDisplayName = () => {
    let user = this.props.user;
    return user.name || user.email || user.username || '';
  };

  render() {
    return (
      <LetterAvatar
        identifier={this.getIdentifier()}
        displayName={this.getDisplayName()}
      />
    );
  }
}

export default UserLetterAvatar;
