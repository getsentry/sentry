import React from 'react';
import {Link} from 'react-router';

import Avatar from './avatar';
import Location from './location';
import TimeSince from './timeSince';

export default React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.array.isRequired,
  },

  getDisplayName(user) {
    return (
      user.username ||
      user.email ||
      user.identifier ||
      `${user.ipAddress} (anonymous)`
    );
  },

  render() {
    let {data, orgId, projectId} = this.props;
    return (
      <table className="table table-bordered user-list">
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Last Hit an Issue</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user) => {
            let link = `/${orgId}/${projectId}/audience/users/${user.hash}/`;
            return (
              <tr key={user.id}>
                <td>
                  <Avatar user={user} size={36} />
                  <Link to={link}>{this.getDisplayName(user)}</Link><br />
                  <small>First seen <TimeSince date={user.dateCreated} /></small>
                </td>
                <td><Location location={user.lastLocation} /></td>
                <td><TimeSince date={user.lastIssue.lastSeen} /><br /><small>{user.lastIssue.project.name}</small></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
});
