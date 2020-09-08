import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {ProcessingIssue} from 'app/types';
import {IconWarning, IconSettings} from 'app/icons';
import TimeSince from 'app/components/timeSince';
import {t, tn, tct} from 'app/locale';
import space from 'app/styles/space';

const defaultProps = {
  showProject: false,
};

type Props = {
  issue: ProcessingIssue;
  orgId: string;
  projectId: string;
} & typeof defaultProps;

class ProcessingIssueHint extends React.Component<Props> {
  static propTypes = {
    issue: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    showProject: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  render() {
    const {orgId, projectId, issue, showProject} = this.props;
    const link = `/settings/${orgId}/projects/${projectId}/processing-issues/`;
    let showButton = false;
    const className = {
      'processing-issues': true,
      alert: true,
    };
    let text = '';
    let lastEvent: React.ReactNode = null;
    let icon: React.ReactNode = null;

    let project: React.ReactNode = null;
    if (showProject) {
      project = (
        <span>
          <strong>{projectId}</strong> &mdash;{' '}
        </span>
      );
    }

    if (issue.numIssues > 0) {
      icon = <IconWarning size="sm" color="red400" />;
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
      icon = <IconSettings size="sm" color="blue400" />;
      className['alert-info'] = true;
      text = tn(
        'Reprocessing %s event …',
        'Reprocessing %s events …',
        issue.issuesProcessing
      );
    } else if (issue.resolveableIssues > 0) {
      icon = <IconSettings size="sm" color="yellow400" />;
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
        <span>
          {icon} {project}
          <strong>{text}</strong> {lastEvent}
        </span>
        {showButton && (
          <Button size="xsmall" to={link}>
            {t('Show details')}
          </Button>
        )}
      </Container>
    );
  }
}

const Container = styled('div')`
  display: flex;
  justify-content: space-between;

  margin: -1px -1px 0;
  padding: 10px 16px;

  svg {
    position: relative;
    top: 3px;
    margin-right: ${space(0.5)};
  }
`;

export default ProcessingIssueHint;
