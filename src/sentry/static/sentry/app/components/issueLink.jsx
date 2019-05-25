import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Hovercard from 'app/components/hovercard';
import Count from 'app/components/count';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';

export default class IssueLink extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    issue: PropTypes.object.isRequired,
    to: PropTypes.string.isRequired,
    card: PropTypes.bool,
  };

  static defaultProps = {
    card: true,
  };

  getMessage(data) {
    const metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return data.culprit || '';
    }
  }

  renderBody() {
    const {organization, issue, orgId, projectId} = this.props;
    const message = this.getMessage(issue);

    const className = classNames(`type-${issue.type}`, `level-${issue.level}`, {
      isBookmarked: issue.isBookmarked,
      hasSeen: issue.hasSeen,
      isResolved: issue.status === 'resolved',
    });

    const streamPath = new Set(organization.features).has('sentry10')
      ? `/organizations/${orgId}/issues/`
      : `/${orgId}/${projectId}/`;

    return (
      <div className={className}>
        <div style={{marginBottom: 15}}>
          <h3>
            <EventOrGroupTitle data={issue} />
          </h3>
          <div className="event-message">
            <span className="error-level">{issue.level}</span>
            {message && <span className="message">{message}</span>}
            {issue.logger && (
              <span className="event-annotation">
                <Link
                  to={{
                    pathname: streamPath,
                    query: {query: 'logger:' + issue.logger},
                  }}
                >
                  {issue.logger}
                </Link>
              </span>
            )}
            {issue.annotations.map((annotation, i) => {
              return (
                <span
                  className="event-annotation"
                  key={i}
                  dangerouslySetInnerHTML={{__html: annotation}}
                />
              );
            })}
          </div>
        </div>
        <div className="row row-flex" style={{marginBottom: 15}}>
          <div className="col-xs-6">
            <h6>{t('First Seen')}</h6>
            <TimeSince date={issue.firstSeen} />
          </div>
          <div className="col-xs-6">
            <h6>{t('Last Seen')}</h6>
            <TimeSince date={issue.lastSeen} />
          </div>
        </div>
        <div className="row row-flex">
          <div className="col-xs-6">
            <h6>{t('Occurrences')}</h6>
            <Count value={issue.count} />
          </div>
          <div className="col-xs-6">
            <h6>{t('Users Affected')}</h6>
            <Count value={issue.userCount} />
          </div>
        </div>
      </div>
    );
  }

  render() {
    const {card, issue, to} = this.props;
    if (!card) {
      return <Link to={to}>{this.props.children}</Link>;
    }

    return (
      <Hovercard body={this.renderBody()} header={issue.shortId}>
        <Link to={to}>{this.props.children}</Link>
      </Hovercard>
    );
  }
}
