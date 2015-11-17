import React from 'react';

function getUserDisplayName(name) {
  let parts = name.split(/@/);
  if (parts.length == 1) {
    return parts[0];
  }
  return parts[0].toLowerCase().replace(/[\.-_]+/, ' ');
}

const UserInfo = React.createClass({
  propTypes: {
    user: React.PropTypes.any.isRequired
  },

  render() {
    // XXX(dcramer): not supported by babel
    // var {user, ...other} = this.props;
    let user = this.props.user;
    let other = {};
    for (let key in this.props) {
      if (key !== 'user') {
        other[key] = this.props[key];
      }
    }

    let name = user.name || user.email;
    let displayName = getUserDisplayName(name);

    return (
      <span title={name} {...other}>{displayName}</span>
    );
  }
});

export default UserInfo;

