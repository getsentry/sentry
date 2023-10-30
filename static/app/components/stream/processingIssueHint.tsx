import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert, AlertProps} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import TimeSince from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ProcessingIssue} from 'sentry/types';

type Props = {
  issue: ProcessingIssue;
  orgId: string;
  projectId: string;
  showProject: boolean;
};

function ProcessingIssueHint({orgId, projectId, issue, showProject}: Props) {
  const link = `/settings/${orgId}/projects/${projectId}/processing-issues/`;
  let showButton = false;
  let text = '';
  let lastEvent: React.ReactNode = null;
  let alertType: AlertProps['type'] = 'error';

  let project: React.ReactNode = null;
  if (showProject) {
    project = (
      <Fragment>
        <strong>{projectId}</strong> &mdash;{' '}
      </Fragment>
    );
  }

  if (issue.numIssues > 0) {
    text = tn(
      'There is %s issue blocking event processing',
      'There are %s issues blocking event processing',
      issue.numIssues
    );
    lastEvent = (
      <Fragment>
        (
        {tct('last event from [ago]', {
          ago: <TimeSince date={issue.lastSeen} />,
        })}
        )
      </Fragment>
    );
    alertType = 'error';
    showButton = true;
  } else if (issue.issuesProcessing > 0) {
    alertType = 'info';
    text = tn(
      'Reprocessing %s event …',
      'Reprocessing %s events …',
      issue.issuesProcessing
    );
  } else if (issue.resolveableIssues > 0) {
    alertType = 'warning';
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
    <StyledAlert
      type={alertType}
      showIcon
      trailingItems={
        showButton && (
          <StyledButton size="xs" to={link}>
            {t('Show details')}
          </StyledButton>
        )
      }
    >
      {project} <strong>{text}</strong> {lastEvent}
    </StyledAlert>
  );
}

export default ProcessingIssueHint;

const StyledAlert = styled(Alert)`
  border-width: 1px 0;
  border-radius: 0;
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledButton = styled(Button)`
  white-space: nowrap;
  margin-left: ${space(1)};
`;
