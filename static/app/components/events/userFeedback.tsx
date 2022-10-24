import {Component} from 'react';
import styled from '@emotion/styled';

import ActivityAuthor from 'sentry/components/activity/author';
import ActivityItem from 'sentry/components/activity/item';
import Clipboard from 'sentry/components/clipboard';
import Link from 'sentry/components/links/link';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {UserReport} from 'sentry/types';
import {escape, nl2br} from 'sentry/utils';

type Props = {
  issueId: string;
  orgId: string;
  report: UserReport;
  className?: string;
};

class EventUserFeedback extends Component<Props> {
  getUrl() {
    const {report, orgId, issueId} = this.props;

    return `/organizations/${orgId}/issues/${issueId}/events/${report.eventID}/?referrer=user-feedback`;
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
