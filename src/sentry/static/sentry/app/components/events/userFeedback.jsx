import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Avatar from 'app/components/avatar';
import Clipboard from 'app/components/clipboard';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import utils from 'app/utils';

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
      ? `/${orgId}/${projectId}/issues/${issueId}/events/${report.event.eventID}/`
      : `/organizations/${orgId}/issues/${issueId}/events/${report.event.eventID}/`;
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
                    <Clipboard value={report.email}>
                      <Email>
                        {report.email}
                        <CopyIcon src="icon-copy" />
                      </Email>
                    </Clipboard>
                    {/* event.eventID might be undefined for legacy accounts */}
                    {report.event.eventID && (
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

const Email = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
  cursor: pointer;
  margin-left: ${space(1)};
`;

const CopyIcon = styled(InlineSvg)`
  margin-left: ${space(0.25)};
`;
