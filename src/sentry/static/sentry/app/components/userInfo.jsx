import React from "react";

function getUserDisplayName(name) {
  var parts = name.split(/@/);
  if (parts.length == 1) {
    return parts[0];
  }
  return parts[0].toLowerCase().replace(/[\.-_]+/, ' ');
}

var UserInfo = React.createClass({
  propTypes: {
    user: React.PropTypes.any.isRequired
  },

  render() {
    // XXX(dcramer): not supported by babel
    // var {user, ...other} = this.props;
    var user = this.props.user;
    var other = {};
    for (var key in this.props) {
      if (key !== 'user') {
        other[key] = this.props[key];
      }
    }

    var name = user.name || user.email;
    var displayName = getUserDisplayName(name);

    return (
      <span title={name} {...other}>{displayName}</span>
    );
  }
});

export default UserInfo;

