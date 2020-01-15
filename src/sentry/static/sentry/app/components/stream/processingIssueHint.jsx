import React from 'react';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styled from '@emotion/styled';

import TimeSince from 'app/components/timeSince';
import {t, tn, tct} from 'app/locale';

class ProcessingIssueHint extends React.Component {
  static propTypes = {
    issue: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    showProject: PropTypes.bool,
  };

  static defaultProps = {
    showProject: false,
  };

  render() {
    const {orgId, projectId, issue, showProject} = this.props;
    const link = `/settings/${orgId}/projects/${projectId}/processing-issues/`;
    let showButton = false;
    const className = {
      'processing-issues': true,
      alert: true,
    };
    let text = null;
    let lastEvent = null;
    let icon = null;

    let project = null;
    if (showProject) {
      project = (
        <span>
          <strong>{projectId}</strong> &mdash;
        </span>
      );
    }

    if (issue.numIssues > 0) {
      icon = <span className="icon icon-alert" />;
      text = tn(
        'There is %s issue blocking event processing',
        'There are %s issues blocking event processing',
        issue.numIssues
      );
      lastEvent = (
        <span className="last-seen">
          (
          {tct('last event from [ago]', {
            ago: <TimeSince date={issue.lastSeen} />,
          })}
          )
        </span>
      );
      className['alert-error'] = true;
      showButton = true;
    } else if (issue.issuesProcessing > 0) {
      icon = <span className="icon icon-processing play" />;
      className['alert-info'] = true;
      text = tn(
        'Reprocessing %s event …',
        'Reprocessing %s events …',
        issue.issuesProcessing
      );
    } else if (issue.resolveableIssues > 0) {
      icon = <span className="icon icon-processing" />;
      className['alert-warning'] = true;
      text = tn(
        'There is %s event pending reprocessing.',
        'There are %s events pending reprocessing.',
        issue.resolveableIssues
      );
      showButton = true;
    } else {
      /* we should not go here but what do we know */
      return null;
    }
    return (
      <Container className={classNames(className)}>
        {showButton && (
          <Link to={link} className="btn btn-default btn-sm pull-right">
            {t('Show details')}
          </Link>
        )}
        {icon} {project}
        <strong>{text}</strong> {lastEvent}{' '}
      </Container>
    );
  }
}

const Container = styled('div')`
  margin: -1px -1px 0;
  padding: 10px 16px;
`;

export default ProcessingIssueHint;
