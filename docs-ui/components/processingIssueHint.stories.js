import React from 'react';
import {boolean} from '@storybook/addon-knobs';
import {withInfo} from '@storybook/addon-info';

import ProcessingIssueHint from 'app/components/stream/processingIssueHint';

export default {
  title: 'Features/Issues/Processing Issue Hint',
};

export const Default = withInfo('default')(() => {
  const issue = {
    project: 'sentry-test',
    numIssues: 6,
    issuesProcessing: 4,
    resolveableIssues: 2,
    signedLink: '',
    lastSeen: new Date().toISOString(),
    hasMoreResolveableIssues: true,
    hasIssues: true,
  };

  const warning = {...issue, numIssues: 0};
  const info = {...issue, numIssues: 0, issuesProcessing: 0};

  return (
    <React.Fragment>
      <ProcessingIssueHint
        issue={issue}
        projectId={issue.project}
        orgId="organization-slug"
        showProject={boolean('Show Project', false)}
      />
      <br />
      <ProcessingIssueHint
        issue={warning}
        projectId={warning.project}
        orgId="organization-slug"
        showProject={boolean('Show Project', false)}
      />
      <br />
      <ProcessingIssueHint
        issue={info}
        projectId={info.project}
        orgId="organization-slug"
        showProject={boolean('Show Project', false)}
      />
    </React.Fragment>
  );
});

Default.story = {
  name: 'default',
};
