import _ from "underscore";
import React from "react";
import Gravatar from "../../components/gravatar";

function keyToName(key) {
  // Take a given key, and transform it from
  // camel case to title case
  if (!key) return '';
  key = key[0].toUpperCase() + key.slice(1);
  return key.replace(/_/g, ' ');
}

function renderLine(key, value, name='') {
  if (name === '') {
    name = keyToName(key);
  }
  return [
    <dt key={key + "-label"}>{name}:</dt>,
    <dd key={key}>{value.toString()}</dd>
  ];
}

var UserWidget = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var user = this.props.data;
    var children = [];

    // Handle our native attributes special
    user.id && children.push(renderLine('id', user.id, 'ID'));
    user.email && children.push(renderLine('email', user.email));
    user.username && children.push(renderLine('username', user.username));
    user.ipAddress && children.push(renderLine('ipAddress', user.ipAddress, 'IP'));

    // We also attach user supplied data as 'user.data'
    _.each(user.data, function(value, key) {
      children.push(renderLine(key, value));
    });

    return (
      <div className="user-widget">
        <div className="pull-right"><Gravatar email={user.email} size={84} /></div>
        <h6><span>User</span></h6>
        <dl>
          {children}
        </dl>
        <div className="btn-group hidden">
          <a href="#" className="btn btn-xs btn-default">Message User</a>
          <a href="#" className="btn btn-xs btn-default">Message All</a>
        </div>
      </div>
    );
  }
});

export default UserWidget;
