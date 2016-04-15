import React from 'react';
import Gravatar from '../../components/gravatar';
import TimeSince from '../../components/timeSince';
import utils from '../../utils';


const EventUserReport = React.createClass({
  propTypes: {
    event: React.PropTypes.object.isRequired
  },

  render() {
    let report = this.props.event.userReport;

    return (
      <div className="user-report">
        <div className="activity-container">
          <ul className="activity">
            <li className="activity-note">
              <Gravatar user={report} size={64} className="avatar" />
              <div className="activity-bubble">
                <TimeSince date={report.dateCreated} />
                <div className="activity-author">{report.name} <small>{report.email}</small></div>
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
