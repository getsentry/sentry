import PropTypes from 'prop-types';
import React from 'react';
import Avatar from 'app/components/avatar';
import TimeSince from 'app/components/timeSince';
import utils from 'app/utils';
import Link from 'app/components/link';

class EventUserReport extends React.Component {
  static propTypes = {
    report: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    issueId: PropTypes.string.isRequired,
  };

  render() {
    let {report, orgId, projectId, issueId} = this.props;

    return (
      <div className="user-report">
        <div className="activity-container">
          <ul className="activity">
            <li className="activity-note">
              <Avatar user={report} size={38} className="avatar" />
              <div className="activity-bubble">
                <div>
                  <TimeSince date={report.dateCreated} />
                  <div className="activity-author">
                    {report.name}
                    <small>{report.email}</small>
                    {/* event_id might be undefined for legacy accounts */}
                    {report.event.id && (
                      <small>
                        <Link
                          to={`/${orgId}/${projectId}/issues/${issueId}/events/${report
                            .event.id}`}
                        >
                          View event
                        </Link>
                      </small>
                    )}
                  </div>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: utils.nl2br(utils.escape(report.comments)),
                    }}
                  />
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    );
  }
}

export default EventUserReport;
