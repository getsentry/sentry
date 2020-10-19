import React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {ProcessingIssue} from 'app/types';
import {IconWarning, IconSettings} from 'app/icons';
import TimeSince from 'app/components/timeSince';
import {t, tn, tct} from 'app/locale';

type Props = {
  showProject: boolean;
  issue: ProcessingIssue;
  orgId: string;
  projectId: string;
};

function ProcessingIssueHint({orgId, projectId, issue, showProject}: Props) {
  const link = `/settings/${orgId}/projects/${projectId}/processing-issues/`;
  let showButton = false;
  let text = '';
  let lastEvent: React.ReactNode = null;
  let icon: React.ReactNode = null;
  let alertType: React.ComponentProps<typeof Alert>['type'] = 'error';

  let project: React.ReactNode = null;
  if (showProject) {
    project = (
      <React.Fragment>
        <strong>{projectId}</strong> &mdash;{' '}
      </React.Fragment>
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
      <React.Fragment>
        (
        {tct('last event from [ago]', {
          ago: <TimeSince date={issue.lastSeen} />,
        })}
        )
      </React.Fragment>
    );
    alertType = 'error';
    showButton = true;
  } else if (issue.issuesProcessing > 0) {
    icon = <IconSettings size="sm" color="blue400" />;
    alertType = 'info';
    text = tn(
      'Reprocessing %s event …',
      'Reprocessing %s events …',
      issue.issuesProcessing
    );
  } else if (issue.resolveableIssues > 0) {
    icon = <IconSettings size="sm" color="yellow400" />;
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
    <StyledAlert type={alertType} icon={icon}>
      <Wrapper>
        <div>
          {project} <strong>{text}</strong> {lastEvent}
        </div>
        {showButton && (
          <div>
            <StyledButton size="xsmall" to={link}>
              {t('Show details')}
            </StyledButton>
          </div>
        )}
      </Wrapper>
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

const Wrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const StyledButton = styled(Button)`
  white-space: nowrap;
`;
