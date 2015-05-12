/*** @jsx React.DOM */

var React = require("react");

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
    var {user, ...other} = this.props;
    var name = user.name || user.email;
    var displayName = getUserDisplayName(name);

    return (
      <span title={name} {...other}>{displayName}</span>
    );
  }
});

module.exports = UserInfo;
