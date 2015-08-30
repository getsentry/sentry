import React from "react";
import Gravatar from "../../components/gravatar";

var UserWidget = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var user = this.props.data;

    return (
      <div className="user-widget">
        <div className="pull-right"><Gravatar email={user.email} size={84} /></div>
        <h6><span>User</span></h6>
        <dl>
          {user.id && [
            <dt key="id-label">ID:</dt>,
            <dd key="id">{user.id}</dd>
          ]}
          {user.email && [
            <dt key="email-label">Email:</dt>,
            <dd key="email">{user.email}</dd>
          ]}
          {user.username && [
            <dt key="username-label">Username:</dt>,
            <dd key="username">{user.username}</dd>
          ]}
          {user.ipAddress && [
            <dt key="ipAddress-label">IP:</dt>,
            <dd key="ipAddress">{user.ipAddress}</dd>
          ]}
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
