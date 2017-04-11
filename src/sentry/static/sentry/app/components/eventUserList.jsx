import React from 'react';

import Avatar from './avatar';
import Location from './location';
import TimeSince from './timeSince';
import EventUserModalLink from './eventUserModalLink';

export default React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.array.isRequired,
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
            return (
              <tr key={user.id}>
                <td>
                  <Avatar user={user} size={36} />
                  <EventUserModalLink user={user} orgId={orgId} projectId={projectId} /><br />
                  <small>First seen <TimeSince date={user.dateCreated} /></small>
                </td>
                <td>{location && <Location location={user.lastLocation} />}</td>
                <td><TimeSince date={user.lastIssue.lastSeen} /><br /><small>{user.lastIssue.project.name}</small></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
});
