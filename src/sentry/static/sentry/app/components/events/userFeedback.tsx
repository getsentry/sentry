import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {UserReport} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import {nl2br, escape} from 'app/utils';
import {t} from 'app/locale';
import ActivityAuthor from 'app/components/activity/author';
import ActivityItem from 'app/components/activity/item';
import Clipboard from 'app/components/clipboard';
import {IconCopy} from 'app/icons';
import Link from 'app/components/links/link';
import space from 'app/styles/space';

type Props = {
  report: UserReport;
  orgId: string;
  issueId: string;
  className?: string;
};

class EventUserFeedback extends React.Component<Props> {
  static propTypes = {
    report: SentryTypes.UserReport.isRequired,
    orgId: PropTypes.string.isRequired,
    issueId: PropTypes.string.isRequired,
    className: PropTypes.string,
  };

  getUrl() {
    const {report, orgId, issueId} = this.props;

    return `/organizations/${orgId}/issues/${issueId}/events/${report.eventID}/`;
  }

  render() {
    const {className, report} = this.props;
    const user = report.user || {
      name: report.name,
      email: report.email,
      id: '',
      username: '',
      ip_address: '',
    };

    return (
      <div className={className}>
        <ActivityItem
          date={report.dateCreated}
          author={{type: 'user', user}}
          header={
            <div>
              <ActivityAuthor>{report.name}</ActivityAuthor>
              <Clipboard value={report.email}>
                <Email>
                  {report.email}
                  <StyledIconCopy size="xs" />
                </Email>
              </Clipboard>
              {report.eventID && (
                <ViewEventLink to={this.getUrl()}>{t('View event')}</ViewEventLink>
              )}
            </div>
          }
        >
          <p
            dangerouslySetInnerHTML={{
              __html: nl2br(escape(report.comments)),
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

const StyledIconCopy = styled(IconCopy)`
  margin-left: ${space(1)};
`;
