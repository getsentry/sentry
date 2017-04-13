import React from 'react';
import Avatar from '../../components/avatar';
import EventUserModalLink from '../../components/eventUserModalLink';
import TimeSince from '../../components/timeSince';
import utils from '../../utils';


const EventUserReport = React.createClass({
  propTypes: {
    event: React.PropTypes.object.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
  },

  render() {
    let report = this.props.event.userReport;
    let {orgId, projectId} = this.props;

    return (
      <div className="user-report">
        <div className="activity-container">
          <ul className="activity">
            <li className="activity-note">
              <Avatar user={report} size={64} className="avatar" />
              <div className="activity-bubble">
                <TimeSince date={report.dateCreated} />
                <div className="activity-author">
                  <EventUserModalLink user={report.user} orgId={orgId} projectId={projectId} />
                  <small>{report.user.email || report.email}</small>
                </div>
                <p dangerouslySetInnerHTML={{__html: utils.nl2br(utils.urlize(utils.escape(report.comments)))}} />
              </div>
            </li>
          </ul>
        </div>
      </div>
    );
  }
});

export default EventUserReport;
