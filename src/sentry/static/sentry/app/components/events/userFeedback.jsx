import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import ActivityAuthor from 'app/components/activity/author';
import ActivityItem from 'app/components/activity/item';
import Clipboard from 'app/components/clipboard';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
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
    const {className, report} = this.props;

    return (
      <div className={className}>
        <ActivityItem
          date={report.dateCreated}
          author={{type: 'user', user: report}}
          header={
            <div>
              <ActivityAuthor>{report.name}</ActivityAuthor>
              <Clipboard value={report.email}>
                <Email>
                  {report.email}
                  <CopyIcon src="icon-copy" />
                </Email>
              </Clipboard>
              {/* event.eventID might be undefined for legacy accounts */}
              {report.event.eventID && (
                <ViewEventLink to={this.getUrl()}>{t('View event')}</ViewEventLink>
              )}
            </div>
          }
        >
          <p
            dangerouslySetInnerHTML={{
              __html: utils.nl2br(utils.escape(report.comments)),
            }}
          />
        </ActivityItem>
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

const ViewEventLink = styled(Link)`
  font-weight: 300;
  margin-left: ${space(1)};
  font-size: 0.9em;
`;

const CopyIcon = styled(InlineSvg)`
  margin-left: ${space(0.25)};
`;
