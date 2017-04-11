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
      <div className="panel panel-default">
        <div className="panel-heading panel-heading-bold">
          <div className="row">
            <div className="col-sm-4">
              Commit
            </div>
            <div className="col-sm-4">
              Location
            </div>
            <div className="col-sm-4">
              Last seen
            </div>
          </div>
        </div>
        <div className="list-group">
          {data.map((user) => {
            return (
              <div className="list-group-item">
                <div className="row">
                  <div className="list-group-avatar col-sm-4">
                    <Avatar user={user} size={36} />
                    <h5><EventUserModalLink user={user} orgId={orgId} projectId={projectId} /></h5>
                    <p className="text-muted">First seen <TimeSince date={user.dateCreated} /></p>
                  </div>
                  <div className="col-sm-4">
                    {location && <Location location={user.lastLocation} />}
                  </div>
                  <div className="col-sm-4">
                    <h5><TimeSince date={user.lastIssue.lastSeen} /></h5>
                    <p className="text-muted">{user.lastIssue.project.name}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
});
