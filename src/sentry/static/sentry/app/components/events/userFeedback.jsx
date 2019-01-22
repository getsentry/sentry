import PropTypes from 'prop-types';
import React from 'react';
import Avatar from 'app/components/avatar';
import TimeSince from 'app/components/timeSince';
import utils from 'app/utils';
import Link from 'app/components/link';

import {t} from 'app/locale';

class EventUserFeedback extends React.Component {
  static propTypes = {
    report: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    issueId: PropTypes.string.isRequired,
    // Provided only in the single project scoped version of this component
    projectId: PropTypes.string,
  };

  getUrl() {
    const {report, orgId, projectId, issueId} = this.props;

    return projectId
      ? `/${orgId}/${projectId}/issues/${issueId}/events/${report.event.id}/`
      : `/organizations/${orgId}/issues/${issueId}/events/${report.event.id}/`;
  }

  render() {
    const {report} = this.props;

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
                        <Link to={this.getUrl()}>{t('View event')}</Link>
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

export default EventUserFeedback;
